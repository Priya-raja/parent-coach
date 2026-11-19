import { z } from 'zod';

export const followUpInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  child_name: z.string().trim().min(1).max(200).optional().describe('The child’s name, if known. Always include it when the parent has provided it.'),
  delay_minutes: z.number().finite().positive().max(525600).describe('The number of minutes from now to schedule the check-in. (e.g., 1 for one minute, 60 for one hour, 1440 for one day).'),
});

const pendingFollowUpSchema = z.object({
  id: z.string().min(1),
  prompt: followUpInputSchema.shape.prompt,
  child_name: followUpInputSchema.shape.child_name,
  dueAt: z.number().finite().nonnegative().max(8.64e15),
});
export type PendingFollowUp = z.infer<typeof pendingFollowUpSchema>;
export const FOLLOW_UP_KEY = 'pendingFollowUps';

export function readFollowUps(storage: Pick<Storage, 'getItem'>): PendingFollowUp[] {
  const raw = storage.getItem(FOLLOW_UP_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid follow-up storage');
  return parsed.flatMap((item) => {
    const result = pendingFollowUpSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

export function saveFollowUp(storage: Pick<Storage, 'getItem' | 'setItem'>, input: unknown): PendingFollowUp {
  const { prompt, delay_minutes, child_name } = followUpInputSchema.parse(input);
  const reminder = { id: crypto.randomUUID(), prompt, ...(child_name ? { child_name } : {}), dueAt: Date.now() + delay_minutes * 60 * 1000 };
  storage.setItem(FOLLOW_UP_KEY, JSON.stringify([...readFollowUps(storage), reminder]));
  return reminder;
}

export function takeDueFollowUp(storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()): PendingFollowUp | undefined {
  const pending = readFollowUps(storage);
  const due = pending.filter((item) => item.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt)[0];
  if (due) storage.setItem(FOLLOW_UP_KEY, JSON.stringify(pending.filter((item) => item.id !== due.id)));
  return due;
}
