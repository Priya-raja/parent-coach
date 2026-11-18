// app/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { type UIMessage } from 'ai';

function getText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState('');
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input.trim() });
    setInput('');
  }
  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <header className="mb-3 border-b pb-3">
        <h1 className="text-xl font-semibold">Parent Coach</h1>
        <p className="text-xs text-gray-500">
          Brief, practical support. Not a substitute for medical, legal, or
          emergency help.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400" dir="auto">
            Ask a parenting concern in English or Urdu. مثال: &ldquo;میرا بچہ رات
            کو نہیں سوتا&rdquo; یا &ldquo;My child refuses to do homework.&rdquo;
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            dir="auto"
            className={`whitespace-pre-wrap rounded-lg p-3 text-sm ${
              m.role === 'user'
                ? 'ml-auto max-w-[85%] bg-blue-50'
                : 'mr-auto max-w-[85%] bg-gray-50'
            }`}
          >
            <strong className="mb-1 block text-xs text-gray-500">
              {m.role === 'user' ? 'You' : 'Coach'}
            </strong>
            {getText(m)}
          </div>
        ))}

        {isLoading && <p className="text-xs text-gray-400">Coach is typing…</p>}
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-red-700">Unable to get a reply. Please try again.</p>}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          aria-label="Your parenting concern"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type in English or Urdu…"
          dir="auto"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
