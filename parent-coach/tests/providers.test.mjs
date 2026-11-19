import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const keys = ['ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_MODEL', 'GOOGLE_MODEL', 'OPENAI_MODEL'];
function load(relative, calls) {
  const filename = path.join(root, relative);
  const compiled = new Module(filename);
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (name) => {
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, calls);
    for (const provider of ['anthropic', 'google', 'openai']) {
      if (name === `@ai-sdk/${provider}`) return { [provider]: (model) => ({ provider, model }) };
    }
    const loaded = originalRequire(name);
    if (name === 'ai') return { ...loaded, streamText: (options) => {
      calls.push(options);
      return { toUIMessageStreamResponse: () => new Response('mock model reply') };
    } };
    return loaded;
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return compiled.exports;
}
async function withEnvironment(values, run) {
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    await run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}
function request(text = 'My child likes cutting paper') {
  return new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }] }) });
}

test('selects Anthropic before Gemini before OpenAI and allows model overrides', async () => {
  for (const [values, expected] of [
    [{ ANTHROPIC_API_KEY: 'test', GOOGLE_GENERATIVE_AI_API_KEY: 'test', OPENAI_API_KEY: 'test' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }],
    [{ GOOGLE_GENERATIVE_AI_API_KEY: 'test', OPENAI_API_KEY: 'test' }, { provider: 'google', model: 'gemini-1.5-flash' }],
    [{ OPENAI_API_KEY: 'test' }, { provider: 'openai', model: 'gpt-4o-mini' }],
    [{ ANTHROPIC_API_KEY: ' ', GOOGLE_GENERATIVE_AI_API_KEY: 'test', GOOGLE_MODEL: ' custom-model ' }, { provider: 'google', model: 'custom-model' }],
  ]) await withEnvironment(values, async () => {
    const calls = [];
    const { POST } = load('app/api/chat/route.ts', calls);
    assert.equal((await POST(request())).status, 200);
    assert.deepEqual(calls[0].model, expected);
    assert.ok(calls[0].tools.schedule_follow_up);
  });
});

test('missing keys return the actionable UI error without calling a provider', async () => {
  await withEnvironment({}, async () => {
    const calls = [];
    const { POST } = load('app/api/chat/route.ts', calls);
    const response = await POST(request());
    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'Please configure an API key in .env.local to start chatting.');
    assert.equal(calls.length, 0);
  });
});

test('English and Urdu crisis responses remain verbatim with no API keys', async () => {
  await withEnvironment({}, async () => {
    const calls = [];
    const { POST } = load('app/api/chat/route.ts', calls);
    const { CRISIS_RESPONSE } = load('lib/safety.ts', calls);
    for (const text of ['I want to hurt myself', 'میرے گھر میں تشدد ہوتا ہے']) {
      const response = await POST(request(text));
      assert.equal(response.status, 200);
      const chunks = (await response.text()).split('\n').filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(6)));
      assert.equal(chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.delta).join(''), CRISIS_RESPONSE);
    }
    assert.equal(calls.length, 0);
  });
});

test('chat transport exposes the missing-key message used by the UI', async () => {
  const { DefaultChatTransport } = await import('ai');
  const transport = new DefaultChatTransport({
    fetch: async () => new Response('Please configure an API key in .env.local to start chatting.', { status: 503 }),
  });
  await assert.rejects(transport.sendMessages({
    trigger: 'submit-message', chatId: 'test', messages: [],
  }), { message: 'Please configure an API key in .env.local to start chatting.' });
});


test('an earlier crisis does not trap later everyday messages or reach the model', async () => {
  await withEnvironment({ OPENAI_API_KEY: 'test' }, async () => {
    const calls = [];
    const { POST } = load('app/api/chat/route.ts', calls);
    const user = (id, text) => ({ id, role: 'user', parts: [{ type: 'text', text }] });
    const messages = [
      user('u1', 'I want to hurt myself'),
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Earlier crisis response' }] },
      user('u2', 'My child likes cutting paper'),
    ];
    const post = (messages) => POST(new Request('http://localhost/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    }));
    assert.equal(await (await post(messages)).text(), 'mock model reply');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].messages, [{ role: 'user', content: [{ type: 'text', text: 'My child likes cutting paper' }] }]);
    const response = await post([...messages, user('u3', 'I want to hurt myself')]);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('text-delta'));
    assert.equal(calls.length, 1);
  });
});


test('selected reply language overrides message language and mixed history', async () => {
  await withEnvironment({ OPENAI_API_KEY: 'test' }, async () => {
    for (const [language, text] of [
      ['en', 'میرا بچہ کھانا نہیں کھاتا'],
      ['ur', 'My child will not eat vegetables'],
    ]) {
      const calls = [];
      const { POST } = load('app/api/chat/route.ts', calls);
      const response = await POST(new Request('http://localhost/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, messages: [
          { id: 'old-user', role: 'user', parts: [{ type: 'text', text: 'Earlier conversation' }] },
          { id: 'old-assistant', role: 'assistant', parts: [{ type: 'text', text: 'پچھلا جواب' }] },
          { id: 'u1', role: 'user', parts: [{ type: 'text', text }] },
        ] }),
      }));
      assert.equal(response.status, 200);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].system.includes(`Reply ONLY in ${language === 'ur' ? 'Urdu' : 'English'}`));
      assert.ok(calls[0].system.endsWith('This selection takes priority over the earlier language-matching instructions.'));
    }
  });
});

test('one chat transport reads the latest reply language for every request', async () => {
  const { DefaultChatTransport } = await import('ai');
  const languageRef = { current: 'en' };
  const bodies = [];
  const transport = new DefaultChatTransport({
    body: () => ({ language: languageRef.current }),
    fetch: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return new Response('data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    },
  });
  for (const language of ['en', 'ur', 'en']) {
    languageRef.current = language;
    const stream = await transport.sendMessages({
      trigger: 'submit-message', chatId: 'language-test', messages: [],
    });
    const reader = stream.getReader();
    while (!(await reader.read()).done) { /* Consume the mock reply. */ }
  }
  assert.deepEqual(bodies.map((body) => body.language), ['en', 'ur', 'en']);
});
