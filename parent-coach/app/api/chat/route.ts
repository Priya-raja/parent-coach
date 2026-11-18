// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  validateUIMessages,
} from 'ai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { isCrisis, CRISIS_RESPONSE } from '@/lib/safety';

export const runtime = 'edge';

function getText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export async function POST(req: Request) {
  let messages: UIMessage[];
  let language: 'en' | 'ur' = 'en';
  try {
    const body = await req.json();
    language = body.language === 'ur' ? 'ur' : 'en';
    messages = await validateUIMessages({ messages: body.messages });
    if (!messages.some((message) => message.role === 'user') ||
        messages.some((message) => message.role !== 'user' && message.role !== 'assistant')) {
      return Response.json({ error: 'Expected a user and assistant conversation.' }, { status: 400 });
    }
  } catch {
    return Response.json({ error: 'Invalid chat messages.' }, { status: 400 });
  }

  // 1. Crisis pre-check — runs BEFORE the model sees anything.
  const hasCrisis = messages.some((message) =>
    message.role === 'user' && isCrisis(getText(message))
  );

  if (hasCrisis) {
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          const id = 'crisis';
          writer.write({ type: 'text-start', id });
          writer.write({ type: 'text-delta', id, delta: CRISIS_RESPONSE });
          writer.write({ type: 'text-end', id });
        },
      }),
    });
  }

  // 2. Normal path — stream from the model.
  const languageInstruction = language === 'ur'
    ? '\n\nCRITICAL: Reply ONLY in Urdu.'
    : '\n\nCRITICAL: Reply ONLY in English.';
  const responseLabels = language === 'ur'
    ? '\nTranslate the mandatory section labels into Urdu: **ہمدردی:**, **یہ آزمائیں:**, **دوبارہ بتائیں:**. Do not include English labels.'
    : '';
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT + languageInstruction + responseLabels,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
