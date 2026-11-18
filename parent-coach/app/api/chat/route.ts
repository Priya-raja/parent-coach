// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  validateUIMessages,
} from 'ai';
import { followUpInputSchema } from '@/lib/follow-ups';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { isCrisis, CRISIS_RESPONSE } from '@/lib/safety';

export const runtime = 'edge';

const tools = {
  schedule_follow_up: tool({
    description: 'Schedule a local parenting check-in. Only schedule after the parent agrees. Give a specific prompt and a positive delay in hours. Include child_name whenever the child’s name is known.',
    inputSchema: followUpInputSchema,
    execute: async () => 'Follow up scheduled.',
  }),
};

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
    messages = await validateUIMessages({ messages: body.messages, tools });
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
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT + languageInstruction,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
