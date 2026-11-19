'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Markdown from 'react-markdown';
import { MISSING_API_KEY_MESSAGE } from '@/lib/chat-errors';
import { FOLLOW_UP_KEY, readFollowUps, saveFollowUp, takeDueFollowUp, type PendingFollowUp } from '@/lib/follow-ups';

import { CHAT_HISTORY_KEY, readChatHistory, saveChatHistory, type ChatMessage } from '@/lib/chat-history';

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
  const languageRef = useRef(language);
  // The SDK stores this body callback and invokes it only when sending a request.
  // eslint-disable-next-line react-hooks/refs
  const [transport] = useState(() => new DefaultChatTransport({
    body: () => ({ language: languageRef.current }),
  }));
  const [schedulingError, setSchedulingError] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState<'restore' | 'save' | 'clear' | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resetting = useRef(false);
  const resetVersion = useRef(0);
  const scheduledCalls = useRef(new Set<string>());
  const inFlightFollowUp = useRef<PendingFollowUp | undefined>(undefined);
  const checkingFollowUps = useRef(false);
  const { messages, setMessages, sendMessage, stop, clearError, status, error } = useChat<ChatMessage>({
    messages: [],
    transport,
    onError: () => {
      const due = inFlightFollowUp.current;
      if (!due || resetting.current) return;
      try {
        const pending = readFollowUps(window.localStorage);
        if (!pending.some((item) => item.id === due.id)) window.localStorage.setItem(FOLLOW_UP_KEY, JSON.stringify([...pending, due]));
      } catch {
        setSchedulingError(true);
      }
    },
    onToolCall: ({ toolCall }) => {
      if (resetting.current || toolCall.toolName !== 'schedule_follow_up' || scheduledCalls.current.has(toolCall.toolCallId)) return;
      try {
        if (typeof window === 'undefined') return;
        saveFollowUp(window.localStorage, toolCall.input);
        scheduledCalls.current.add(toolCall.toolCallId);
        setSchedulingError(false);
      } catch {
        setSchedulingError(true);
      }
    },
  });
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const copy = translations[language];
  const [input, setInput] = useState('');
  const conversation = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const followReplies = useRef(true);
  const lastScrollTop = useRef(0);
  const isLoading = status === 'submitted' || status === 'streaming';
  // Only synthetic user turns are hidden; assistant metadata never hides a reply.
  const visibleMessages = messages.filter((message) =>
    (message.role === 'assistant' || (message.role === 'user' && !message.metadata?.hiddenFollowUp)) &&
    getText(message).trim().length > 0
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    async function restore() {
      try {
        const saved = await readChatHistory(window.localStorage);
        if (!cancelled) setMessages(saved);
      } catch {
        if (!cancelled) setHistoryError('restore');
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [setMessages]);

  useEffect(() => {
    if (typeof window === 'undefined' || !historyReady || isResetting) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || resetting.current) return;
      try {
        saveChatHistory(window.localStorage, messages);
        setHistoryError((current) => current === 'save' ? null : current);
      } catch {
        setHistoryError('save');
      }
    });
    return () => { cancelled = true; };
  }, [messages, historyReady, isResetting]);

  useEffect(() => {
    const element = conversation.current;
    if (!element) return;
    let frame = 0;
    const scrollToLatest = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!followReplies.current) return;
        element.scrollTop = element.scrollHeight;
        lastScrollTop.current = element.scrollTop;
      });
    };
    // Observe actual layout, including streaming text, fonts, and composer resizing.
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    scrollToLatest();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [historyReady, messages.length]);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [input, language]);

  useEffect(() => {
    if (typeof window === 'undefined' || !historyReady || isResetting) return;
    const version = resetVersion.current;
    let disposed = false;

    async function checkFollowUps() {
      if (disposed || resetting.current || checkingFollowUps.current || isLoading || status === 'error' || !navigator.onLine || document.visibilityState === 'hidden') return;
      checkingFollowUps.current = true;
      let due: PendingFollowUp | undefined;
      try {
        // Web Locks serialize checks across tabs when supported.
        const deliver = async () => {
          if (disposed || resetting.current || version !== resetVersion.current) return;
          try {
            due = takeDueFollowUp(window.localStorage);
          } catch {
            setSchedulingError(true);
            return;
          }
          if (!due) return;
          inFlightFollowUp.current = due;
          // Read the latest chat sender when the timer fires, not when it starts.
          await sendMessageRef.current({
            role: 'user',
            metadata: { hiddenFollowUp: true },
            parts: [{ type: 'text', text: `System instruction: It is time for the follow-up you scheduled. Check in on how ${due.child_name ?? 'your child'} is doing with ${due.prompt}. Generate the follow-up now.` }],
          });
        };
        if (navigator.locks) await navigator.locks.request('parent-coach-follow-ups', { ifAvailable: true }, async (lock) => { if (lock) await deliver(); });
        else await deliver();
      } catch {
        // Preserve a reminder if dispatch itself throws before completing.
        if (due && version === resetVersion.current && !resetting.current) {
          try {
            const pending = readFollowUps(window.localStorage);
            const reminder = due;
            if (!pending.some((item) => item.id === reminder.id)) window.localStorage.setItem(FOLLOW_UP_KEY, JSON.stringify([...pending, reminder]));
          } catch {
            setSchedulingError(true);
          }
        }
      } finally {
        inFlightFollowUp.current = undefined;
        checkingFollowUps.current = false;
      }
    }

    void checkFollowUps();
    const interval = window.setInterval(() => { void checkFollowUps(); }, 60_000);
    const onResume = () => { void checkFollowUps(); };
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [isLoading, status, historyReady, isResetting]);

  function handleLanguageChange(nextLanguage: 'en' | 'ur') {
    languageRef.current = nextLanguage;
    setLanguage(nextLanguage);
  }

  async function handleClearChat() {
    if (resetting.current) return;
    resetting.current = true;
    resetVersion.current += 1;
    setIsResetting(true);
    inFlightFollowUp.current = undefined;
    try {
      await stop();
      setMessages([]);
      clearError();
      setInput('');
      scheduledCalls.current.clear();
      followReplies.current = true;
      setSchedulingError(false);
      let failed = false;
      for (const key of [CHAT_HISTORY_KEY, FOLLOW_UP_KEY]) {
        try { window.localStorage.removeItem(key); } catch { failed = true; }
      }
      setHistoryError(failed ? 'clear' : null);
    } finally {
      resetting.current = false;
      setIsResetting(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || isLoading || !historyReady || resetting.current) return;
    followReplies.current = true;
    void sendMessage({ text: input.trim() });
    setInput('');
  }

  return (
    <main className="coach-shell">
      <header className="greeting">
        <span className="brand-mark"><Sprout small /></span>
        <div className="greeting-text"><p className="eyebrow">PARENT COACH</p><p className="greeting-copy" lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'}>{language === 'ur' ? <>صبح بخیر۔<br /><span>سکون آپ کے قریب ہے۔</span></> : <>Good morning.<br /><span>A calmer you is closer.</span></>}</p></div>
        <div className="header-actions">
          <svg className="sun" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
          <div className="language-toggle" role="group" aria-label="Reply language">
            {(['en', 'ur'] as const).map((option) => <button key={option} type="button" disabled={!historyReady || isResetting} aria-label={option === 'en' ? 'English' : 'Urdu'} aria-pressed={language === option} onClick={() => handleLanguageChange(option)}>{option.toUpperCase()}</button>)}
          </div>
          <button type="button" className="clear-chat" disabled={!historyReady || isResetting} onClick={() => { void handleClearChat(); }} aria-label={language === 'ur' ? 'گفتگو صاف کریں' : 'Clear chat'} title={language === 'ur' ? 'گفتگو صاف کریں' : 'Clear chat'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" /></svg>
          </button>
        </div>
      </header>

      <section className="chat-space" aria-label="Parenting conversation">

        <div ref={conversation} className="conversation" onScroll={(event) => {
          const element = event.currentTarget;
          const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          if (nearBottom) followReplies.current = true;
          else if (element.scrollTop < lastScrollTop.current) followReplies.current = false;
          lastScrollTop.current = element.scrollTop;
        }} tabIndex={0} role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text" aria-busy={isLoading || !historyReady}>
          {!historyReady ? (
            <p className="history-status" role="status" lang={language} dir="auto">{language === 'ur' ? 'گفتگو لوڈ ہو رہی ہے…' : 'Loading your conversation…'}</p>
          ) : messages.length === 0 ? (
            <div className="welcome" lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'}>
              <div className="welcome-emblem"><Sprout /></div>
              <h1>{copy.headline}<br /><em>{copy.reassurance}</em></h1>
              <p className="welcome-copy">{copy.subtext}{language === 'en' && <><br />{copy.nextStep}</>}</p>
              <p className="urdu-welcome" lang="ur" dir="rtl">{translations.ur.nextStep}</p>
              <div className="suggestions" aria-label={copy.startLabel}>
                <p>{copy.startLabel}</p>
                {copy.suggestions.map((text) => <button type="button" key={text} onClick={() => { setInput(text); inputRef.current?.focus(); }}>{text}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg></button>)}
              </div>
            </div>
          ) : (
            <div className="message-list">
              <div className="conversation-start"><Sprout small /><span lang={language} dir="auto">{language === 'ur' ? 'ایک وقت میں ایک چھوٹا قدم' : 'One small step at a time'}</span></div>
              {visibleMessages.map((message) => {
                const isAssistant = message.role === 'assistant';
                const author = isAssistant
                  ? (language === 'ur' ? 'پیرنٹ کوچ' : 'Parent Coach')
                  : (language === 'ur' ? 'آپ' : 'You');
                return (
                <article key={message.id} dir="auto" aria-labelledby={`author-${message.id}`} className={`message ${isAssistant ? 'message-coach' : 'message-user'}`}>
                  <p id={`author-${message.id}`} className="message-author" lang={language} dir="auto">{author}</p>
                  <div className="message-body">{message.role === 'user' ? getText(message) : <Markdown components={{ p: ({ children }) => <p dir="auto" className="mb-3 last:mb-0">{children}</p>, li: ({ children }) => <li dir="auto">{children}</li>, a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{getText(message)}</Markdown>}</div>
                </article>
                );
              })}
              {isLoading && <p className="typing" lang={language} dir="auto" role="status"><span />{language === 'ur' ? (status === 'streaming' ? 'کوچ جواب دے رہا ہے…' : 'کوچ سوچ رہا ہے…') : `Coach is ${status === 'streaming' ? 'replying' : 'thinking'}…`}</p>}
            </div>
          )}
        </div>
      </section>

      <footer className="composer-area">
        {historyError && <p role="status" className="error-message" lang={language} dir="auto">{language === 'ur'
          ? (historyError === 'clear' ? 'اس براؤزر سے محفوظ گفتگو یا چیک اِن حذف نہیں ہو سکے۔' : 'اس براؤزر میں گفتگو بحال یا محفوظ نہیں ہو سکی۔ آپ بات جاری رکھ سکتے ہیں۔')
          : (historyError === 'restore' ? 'Saved conversation couldn’t be restored. You can start a new chat.' : historyError === 'clear' ? 'Saved conversation or check-ins couldn’t be cleared in this browser.' : 'This conversation couldn’t be saved. You can keep chatting, but it may be lost on refresh.')}</p>}
        {schedulingError && <p role="status" className="error-message" lang={language} dir="auto">{language === 'ur' ? 'اس براؤزر میں چیک اِن محفوظ نہیں ہو سکا۔ آپ بعد میں خود واپس آ سکتے ہیں۔' : 'Check-ins couldn’t be saved in this browser. You can still return here when you’re ready.'}</p>}
        {error && <p role="alert" className="error-message" lang={language} dir="auto">{error.message === MISSING_API_KEY_MESSAGE
          ? (language === 'ur' ? 'چیٹ شروع کرنے کے لیے .env.local میں API کلید درج کریں۔' : MISSING_API_KEY_MESSAGE)
          : (language === 'ur' ? 'آپ کا پیغام مکمل نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔' : 'Your message couldn’t be completed. Please try again.')}</p>}
        <form onSubmit={handleSubmit} className="composer">
          <textarea disabled={!historyReady || isResetting} ref={inputRef} rows={1} aria-label={language === 'ur' ? 'آپ کی پریشانی' : 'Your parenting concern'} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={language === 'ur' ? 'آپ کے ذہن میں کیا ہے؟' : "What's on your mind?"} lang={language} dir={language === 'ur' ? 'rtl' : 'ltr'} />
          <button type="submit" disabled={!historyReady || isResetting || isLoading || !input.trim()} aria-label={language === 'ur' ? 'پیغام بھیجیں' : 'Send message'}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 14-7-7 14-1.5-5.5L5 12Zm5.5 1.5L19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        </form>
        <p className="language-note">English or اردو · A little support, at your pace</p>
        <p className="disclaimer">Coaching support. Not a substitute for medical, legal, or emergency help.</p>
      </footer>
    </main>
  );
}
