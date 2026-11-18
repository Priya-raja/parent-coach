'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Markdown from 'react-markdown';

function getText(message: UIMessage): string {
  return message.parts.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map((part) => part.text).join('');
}

function Sprout({ small = false }: { small?: boolean }) {
  return <svg width={small ? 22 : 46} height={small ? 22 : 46} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 40V23M24 32C12 33 7 26 8 16c10 0 16 5 16 16ZM24 25C24 14 30 8 40 8c1 10-5 17-16 17Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

const translations = {
  en: {
    eyebrow: 'A LITTLE SPACE TO RESET',
    headline: 'Parenting is a lot.',
    reassurance: 'You don’t have to hold it all alone.',
    subtext: 'Take a breath. Tell me what’s on your mind.',
    nextStep: 'We’ll find a small next step, together.',
    startLabel: 'NOT SURE WHERE TO START?',
    suggestions: ['Bedtime feels like a battle', 'Help me stay calm', 'My child won’t listen'],
  },
  ur: {
    eyebrow: 'ایک چھوٹی سی جگہ سکون کے لیے',
    headline: 'والدین ہونا آسان نہیں۔',
    reassurance: 'آپ کو یہ سب اکیلے نہیں کرنا ہے۔',
    subtext: 'ایک گہری سانس لیں۔ مجھے بتائیں آپ کے ذہن میں کیا ہے۔',
    nextStep: 'آئیے، مل کر کوئی راستہ ڈھونڈتے ہیں۔',
    startLabel: 'سمجھ نہیں آ رہا کہاں سے شروع کریں؟',
    suggestions: ['سونے کا وقت ایک جنگ لگتا ہے', 'مجھے پرسکون رہنے میں مدد کریں', 'میرا بچہ نہیں سنتا'],
  },
};

export default function ChatPage() {
  const [language, setLanguage] = useState<'en' | 'ur'>('en');
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ body: { language } }),
  });
  const copy = translations[language];
  const [input, setInput] = useState('');
  const conversation = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    const element = conversation.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input.trim() });
    setInput('');
  }

  return (
    <main className="coach-shell">
      <header className="greeting">
        <span className="brand-mark"><Sprout small /></span>
        <div className="greeting-text"><p className="eyebrow">PARENT COACH</p><p className="greeting-copy" lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'}>{language === 'ur' ? <>صبح بخیر۔<br /><span>سکون آپ کے قریب ہے۔</span></> : <>Good morning.<br /><span>A calmer you is closer.</span></>}</p></div>
        <div className="header-actions">
          <span className="sun" aria-hidden="true">☀</span>
          <div className="language-toggle" role="group" aria-label="Reply language">
            {(['en', 'ur'] as const).map((option) => <button key={option} type="button" aria-label={option === 'en' ? 'English' : 'Urdu'} aria-pressed={language === option} onClick={() => setLanguage(option)}>{option.toUpperCase()}</button>)}
          </div>
        </div>
      </header>

      <section className="chat-space" aria-label="Parenting conversation">
        <div ref={conversation} className="conversation" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text" aria-busy={isLoading}>
          {messages.length === 0 ? (
            <div className="welcome" lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'}>
              <div className="welcome-emblem"><Sprout /></div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.headline}<br /><em>{copy.reassurance}</em></h1>
              <p className="welcome-copy">{copy.subtext}{language === 'en' && <><br />{copy.nextStep}</>}</p>
              <p className="urdu-welcome" lang="ur" dir="rtl">{translations.ur.nextStep}</p>
              <div className="suggestions" aria-label={copy.startLabel}>
                <p>{copy.startLabel}</p>
                {copy.suggestions.map((text) => <button type="button" key={text} onClick={() => { setInput(text); inputRef.current?.focus(); }}>{text}<span aria-hidden="true">↗</span></button>)}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="conversation-start"><Sprout small /><span>One small step at a time</span></div>
              {messages.map((message) => (
                <article key={message.id} dir="auto" className={`message ${message.role === 'user' ? 'message-user' : 'message-coach'}`}>
                  <p className="message-author">{message.role === 'user' ? 'You' : 'Parent Coach'}</p>
                  <div className="message-body">{message.role === 'user' ? getText(message) : <Markdown components={{ p: ({ children }) => <p dir="auto">{children}</p>, li: ({ children }) => <li dir="auto">{children}</li>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{getText(message)}</Markdown>}</div>
                </article>
              ))}
              {isLoading && <p className="typing" role="status"><span />Coach is {status === 'streaming' ? 'replying' : 'thinking'}…</p>}
            </div>
          )}
        </div>
      </section>

      <footer className="composer-area">
        {error && <p role="alert" className="error-message">Your message couldn’t be completed. Please try again.</p>}
        <form onSubmit={handleSubmit} className="composer">
          <textarea ref={inputRef} rows={1} aria-label="Your parenting concern" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={language === 'ur' ? 'آپ کے ذہن میں کیا ہے؟' : "What's on your mind?"} lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'} />
          <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send message"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 14-7-7 14-1.5-5.5L5 12Zm5.5 1.5L19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </form>
        <p className="language-note">English or اردو · A little support, at your pace</p>
        <p className="disclaimer">Coaching support. Not a substitute for medical, legal, or emergency help.</p>
      </footer>
    </main>
  );
}
