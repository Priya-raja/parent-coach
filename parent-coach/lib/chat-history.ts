import { validateUIMessages, type UIMessage } from 'ai';
import { z } from 'zod';

export const CHAT_HISTORY_KEY = 'parentCoachChatHistory';
export type ChatMessage = UIMessage<{ hiddenFollowUp?: boolean }>;

export async function readChatHistory(storage: Pick<Storage, 'getItem'>): Promise<ChatMessage[]> {
  const raw = storage.getItem(CHAT_HISTORY_KEY);
  if (!raw) return [];
  const messages = await validateUIMessages<ChatMessage>({
    messages: JSON.parse(raw),
    metadataSchema: z.object({ hiddenFollowUp: z.boolean().optional() }).optional(),
  });
  if (messages.some((message) => message.role !== 'user' && message.role !== 'assistant')) {
    throw new Error('Invalid conversation history');
  }
  // A refresh may interrupt a tool call. Keep completed tool history, but do
  // not send unfinished invocations back to the model without a result.
  return messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) =>
      !(part.type.startsWith('tool-') || part.type === 'dynamic-tool') ||
      ('state' in part && typeof part.state === 'string' && ['output-available', 'output-error', 'output-denied'].includes(part.state))
    ),
  }));
}

export function saveChatHistory(storage: Pick<Storage, 'setItem' | 'removeItem'>, messages: ChatMessage[]): void {
  if (messages.length === 0) storage.removeItem(CHAT_HISTORY_KEY);
  else storage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
}
