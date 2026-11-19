import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
function load(relative) {
  const filename = fileURLToPath(new URL(relative, import.meta.url));
  const compiled = new Module(filename);
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return compiled.exports;
}
const { CHAT_HISTORY_KEY, readChatHistory, saveChatHistory } = load('../lib/chat-history.ts');
function storage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (key, next) => { assert.equal(key, CHAT_HISTORY_KEY); value = next; },
    removeItem: (key) => { assert.equal(key, CHAT_HISTORY_KEY); value = null; },
  };
}
const user = { id: 'user', role: 'user', parts: [{ type: 'text', text: 'میرا بچہ کھانا نہیں کھاتا' }] };
test('restores exact English/Urdu text and crisis responses', async () => {
  const { CRISIS_RESPONSE } = load('../lib/safety.ts');
  const messages = [user, { id: 'crisis', role: 'assistant', parts: [{ type: 'text', text: CRISIS_RESPONSE }] }];
  const store = storage();
  saveChatHistory(store, messages);
  assert.deepEqual(JSON.parse(JSON.stringify(await readChatHistory(store))), messages);
});
test('preserves hidden trigger metadata and completed tool results', async () => {
  const messages = [
    { ...user, metadata: { hiddenFollowUp: true } },
    { id: 'coach', role: 'assistant', parts: [{ type: 'tool-schedule_follow_up', toolCallId: 't1', state: 'output-available', input: { prompt: 'How was bedtime?', delay_minutes: 1440 }, output: 'Follow up scheduled.' }] },
  ];
  const store = storage();
  saveChatHistory(store, messages);
  assert.deepEqual(JSON.parse(JSON.stringify(await readChatHistory(store))), messages);
});
test('removes incomplete tool invocations after an interrupted stream', async () => {
  const store = storage(JSON.stringify([{ id: 'coach', role: 'assistant', parts: [
    { type: 'text', text: 'Let’s check in.' },
    { type: 'tool-schedule_follow_up', toolCallId: 't1', state: 'input-streaming' },
  ] }]));
  assert.deepEqual((await readChatHistory(store))[0].parts, [{ type: 'text', text: 'Let’s check in.' }]);
});
test('rejects corrupt history and invalid hidden metadata', async () => {
  for (const raw of ['{', '{}', '[null]', JSON.stringify([{ ...user, metadata: { hiddenFollowUp: 'yes' } }]), JSON.stringify([{ ...user, role: 'system' }])]) {
    await assert.rejects(readChatHistory(storage(raw)));
  }
});
test('empty conversations remove the stored key', async () => {
  const store = storage(JSON.stringify([user]));
  saveChatHistory(store, []);
  assert.equal(store.getItem(CHAT_HISTORY_KEY), null);
  assert.deepEqual(await readChatHistory(store), []);
});
test('storage failures propagate for graceful UI recovery', async () => {
  await assert.rejects(readChatHistory({ getItem: () => { throw Error('Privacy'); } }), /Privacy/);
  assert.throws(() => saveChatHistory({ setItem: () => { throw Error('Quota'); } }, [user]), /Quota/);
});
