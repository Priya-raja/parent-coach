import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const filename = fileURLToPath(new URL('../lib/follow-ups.ts', import.meta.url));
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { followUpInputSchema, readFollowUps, saveFollowUp, takeDueFollowUp, FOLLOW_UP_KEY } = compiled.exports;
const storage = (initial = null) => {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { assert.equal(key, FOLLOW_UP_KEY); value = next; } };
};

test('validates prompts and bounded positive delays', () => {
  for (const delay_minutes of [0, -1, Infinity, NaN, 525601, '24']) {
    assert.equal(followUpInputSchema.safeParse({ prompt: 'Check bedtime', delay_minutes }).success, false);
  }
  assert.equal(followUpInputSchema.safeParse({ prompt: ' ', delay_minutes: 1440 }).success, false);
  assert.equal(followUpInputSchema.parse({ prompt: ' Check bedtime ', delay_minutes: .5 }).prompt, 'Check bedtime');
});
test('saves multiple reminders without overwriting and calculates due time', () => {
  const store = storage();
  const before = Date.now();
  const first = saveFollowUp(store, { prompt: 'Check bedtime', delay_minutes: 1440 });
  saveFollowUp(store, { prompt: 'کھانا کیسا رہا؟', delay_minutes: 4320 });
  assert.equal(readFollowUps(store).length, 2);
  assert.ok(first.dueAt >= before + 86400000 && first.dueAt <= Date.now() + 86400000);
  assert.notEqual(readFollowUps(store)[0].id, readFollowUps(store)[1].id);
});
test('claims one overdue reminder, retaining future and other due entries', () => {
  const store = storage(JSON.stringify([{ id: 'a', prompt: 'First', dueAt: 1 }, { id: 'b', prompt: 'Second', dueAt: 2 }, { id: 'c', prompt: 'Later', dueAt: 100 }]));
  assert.equal(takeDueFollowUp(store, 10).id, 'a');
  assert.equal(takeDueFollowUp(store, 10).id, 'b');
  assert.equal(takeDueFollowUp(store, 10), undefined);
  assert.equal(readFollowUps(store)[0].id, 'c');
});
test('fractional minutes schedule a check-in after 1.8 seconds', () => {
  const store = storage();
  const before = Date.now();
  const reminder = saveFollowUp(store, { prompt: 'Quick check-in', delay_minutes: 0.03 });
  assert.ok(reminder.dueAt >= before + 1800 && reminder.dueAt <= Date.now() + 1800);
  assert.equal(takeDueFollowUp(store, reminder.dueAt - 1), undefined);
  assert.equal(takeDueFollowUp(store, reminder.dueAt).id, reminder.id);
});
test('rejects corrupt storage and ignores malformed entries', () => {
  assert.throws(() => readFollowUps(storage('{')));
  assert.throws(() => readFollowUps(storage('{}')));
  assert.deepEqual(readFollowUps(storage('[null,{"id":"bad","prompt":"x","dueAt":-1}]')), []);
});
test('storage failures propagate to the UI handler without claiming delivery', () => {
  const store = { getItem: () => '[{"id":"a","prompt":"Check in","dueAt":1}]', setItem: () => { throw new Error('Quota'); } };
  assert.throws(() => takeDueFollowUp(store, 10), /Quota/);
  assert.throws(() => saveFollowUp(store, { prompt: 'Check in', delay_minutes: 1440 }), /Quota/);
  assert.throws(() => readFollowUps({ getItem: () => { throw new Error('Privacy'); } }), /Privacy/);
});

test('English and Urdu crisis inputs still trigger the fixed safety path', () => {
  const safetyFilename = fileURLToPath(new URL('../lib/safety.ts', import.meta.url));
  const safety = new Module(safetyFilename);
  safety._compile(ts.transpileModule(fs.readFileSync(safetyFilename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, safetyFilename);
  assert.equal(safety.exports.isCrisis('I want to hurt myself'), true);
  assert.equal(safety.exports.isCrisis('میرے گھر میں تشدد ہوتا ہے'), true);
  assert.equal(safety.exports.isCrisis('My child is having a tantrum'), false);
  assert.equal(safety.exports.isCrisis('میرا بچہ کھانا نہیں کھاتا'), false);
});

test('SDK accepts completed scheduling tool parts on the next turn', async () => {
  const { tool, validateUIMessages, convertToModelMessages } = await import('ai');
  const tools = { schedule_follow_up: tool({ inputSchema: followUpInputSchema, execute: async () => 'Follow up scheduled.' }) };
  const messages = await validateUIMessages({ tools, messages: [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Check in tomorrow' }] },
    { id: 'a1', role: 'assistant', parts: [{ type: 'tool-schedule_follow_up', toolCallId: 'call1', state: 'output-available', input: { prompt: 'How was bedtime?', delay_minutes: 1440 }, output: 'Follow up scheduled.' }] },
    { id: 'u2', role: 'user', metadata: { hiddenFollowUp: true }, parts: [{ type: 'text', text: 'It is time for the scheduled check-in.' }] },
  ] });
  const modelMessages = await convertToModelMessages(messages);
  assert.ok(modelMessages.some((message) => message.role === 'tool'));
  assert.equal(modelMessages.at(-1).role, 'user');
});

test('persists known child names and preserves reminders created before names were added', () => {
  const store = storage('[{"id":"old","prompt":"bedtime","dueAt":1}]');
  saveFollowUp(store, { prompt: 'eating vegetables', delay_minutes: 1440, child_name: '  عائشہ  ' });
  const pending = readFollowUps(store);
  assert.equal(pending[0].child_name, undefined);
  assert.equal(pending[1].child_name, 'عائشہ');
  assert.equal(takeDueFollowUp(store, pending[1].dueAt).id, 'old');
  assert.equal(takeDueFollowUp(store, pending[1].dueAt).child_name, 'عائشہ');
  assert.equal(followUpInputSchema.safeParse({ prompt: 'bedtime', delay_minutes: 1440, child_name: 4 }).success, false);
});
