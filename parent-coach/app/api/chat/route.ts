// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
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
import { MISSING_API_KEY_MESSAGE } from '@/lib/chat-errors';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { isCrisis, CRISIS_RESPONSE } from '@/lib/safety';

export const runtime = 'edge';

function getModel() {
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return anthropic(process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5-5');
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return google(process.env.GOOGLE_MODEL?.trim() || 'gemini-1.5-flash');
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return openai(process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini');
  }
  throw new Error('No API key found. Please set ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OPENAI_API_KEY in .env.local');
}

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

  // Screen every user turn, but only the current crisis blocks this request.
  // Earlier crisis exchanges stay visible in the UI and never reach the model.
  const crisisIndexes = messages.flatMap((message, index) =>
    message.role === 'user' && isCrisis(getText(message)) ? [index] : []
  );
  const lastUserIndex = messages.reduce((last, message, index) => message.role === 'user' ? index : last, -1);
  const lastCrisisIndex = crisisIndexes.at(-1) ?? -1;
  const hasCrisis = lastCrisisIndex === lastUserIndex;
  const nextUserIndex = lastCrisisIndex < 0 ? 0 : messages.findIndex((message, index) =>
    index > lastCrisisIndex && message.role === 'user'
  );
  const modelMessages = messages.slice(nextUserIndex < 0 ? messages.length : nextUserIndex);

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

  // Configuration errors are returned as text so useChat can display them.
  // Keep this after the crisis gate: crisis responses need no provider or key.
  let model;
  try {
    model = getModel();
  } catch {
    return new Response(MISSING_API_KEY_MESSAGE, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // 2. Normal path — stream from the model.
  // The explicit reply-language selection overrides automatic language matching.
  const languageInstruction = `\n\nReply language override: The parent selected ${language === 'ur' ? 'Urdu' : 'English'}. Reply ONLY in ${language === 'ur' ? 'Urdu' : 'English'}, regardless of the language of previous messages or a scheduled follow-up instruction. This selection takes priority over the earlier language-matching instructions.`;
  const result = streamText({
    model,
    system: SYSTEM_PROMPT + languageInstruction,
    messages: await convertToModelMessages(modelMessages),
    tools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
