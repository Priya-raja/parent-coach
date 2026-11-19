# Parent Coach

A bilingual English/Urdu AI parenting coach built with Next.js 15, Tailwind CSS, and the Vercel AI SDK. Parents can describe a concern and receive brief, practical guidance with a follow-up check-in. No login or database is required.

## Features

- **Crisis safety gate:** Recognized English and Urdu crisis phrases bypass the LLM and return a fixed bilingual escalation response directing the parent to emergency or child protection services.
- **Child development coaching:** A warm, analytical coaching persona asks for the child's name, age, and context before offering one or two practical steps. The prompt prohibits diagnosis and medical or legal instructions.
- **Follow-up check-ins:** With the parent's agreement, tool calling schedules personalized check-ins in browser local storage.
- **Bilingual interface:** Replies follow the language of the parent’s message, with right-to-left rendering for Urdu. The EN/UR toggle changes the interface and supplies a fallback for messages with no identifiable language.
- **Conversation history:** Messages persist in the same browser. Clear chat removes saved conversation history and pending check-ins.
- **Multiple providers:** Supports Anthropic, Google Gemini, and OpenAI.

## Requirements

- Node.js 20.9 or later
- npm
- An API key for one supported provider, with access to the app's default model

## Clone and install

```bash
git clone https://github.com/Priya-raja/parent-coach.git
cd parent-coach/parent-coach
npm install
```

The repository contains a nested application folder. Run the remaining commands from the folder containing `package.json`.

## Configure your API key

Create `.env.local` in the application folder, alongside `package.json`. Add **one** of the following keys.

**OpenAI:**

```env
OPENAI_API_KEY=your_api_key_here
```

**Anthropic:**

```env
ANTHROPIC_API_KEY=your_api_key_here
```

**Google Gemini:**

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

No model name is required; the app selects a default model. If multiple keys are present, it selects Anthropic first, then Google Gemini, then OpenAI. It does not automatically switch providers if a request fails.

Keep `.env.local` private and never commit API keys to GitHub. Provider usage is subject to your account's access, limits, and billing.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Restart the development server after changing `.env.local`.

To build and run in production mode:

```bash
npm run build
npm start
```

## Manual testing

Type in English or Urdu; replies follow your message language. Choose **EN** or **UR** for the interface. Start a fresh chat for each independent scenario.

| Scenario | Input | Expected behavior |
| --- | --- | --- |
| Everyday concern | My son Ali is 4. He has tantrums at bedtime. | Brief coaching with practical steps and a follow-up offer. |
| Missing context | My child won't listen. | A short response asking for the child's name, age, and relevant context. |
| Urdu coaching | میری بیٹی عائشہ چار سال کی ہے اور سبزیاں نہیں کھاتی۔ | An Urdu response rendered right to left, including when EN is selected. |
| Harmless activity | My child likes cutting paper. | Normal conversation without triggering the crisis gate. |
| English crisis | I want to hurt myself. | The fixed bilingual escalation response, without LLM generation. |
| Urdu crisis | میرے گھر میں تشدد ہوتا ہے اور میرا بچہ خطرے میں ہے۔ | The fixed bilingual escalation response, without LLM generation. |
| Roman Urdu crisis | Main khud ko nuqsan pohanchana chahta hoon. | The fixed bilingual escalation response. |
| Follow-up | After coaching, say: Yes, check in tomorrow. | A check-in is saved when the model calls the scheduling tool. |
| Persistence | Refresh after exchanging messages. | The conversation is restored in the same browser. |
| Reset | Click the clear-chat button. | Saved conversation history and pending check-ins are removed. |

### Check recovery after a crisis turn

In the same chat, send `I want to hurt myself`, followed by `My child likes cutting paper`. The first message should receive the fixed escalation response; the second should receive a normal response. Earlier crisis exchanges remain visible but are excluded from subsequent LLM coaching context.

## Automated checks

```bash
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit --incremental false
```

Tests cover conversation storage, follow-up scheduling, safety phrases, provider selection, and recovery after a crisis turn.

## Follow-up and safety limitations

Check-ins are processed while the page is open, visible, and online, or when the parent returns after they become due. They are not background notifications, email, or SMS. Clearing browser storage removes saved conversations and reminders.

The safety gate uses phrase matching and cannot recognize every crisis wording. The LLM also receives safety instructions, but generated responses can vary. This demonstration app is not an emergency service or a replacement for professional support.

## Troubleshooting

- **Missing API key:** Check that `.env.local` is alongside `package.json`, enter one supported key, and restart the server.
- **Provider request fails:** Confirm that the key is valid and the account has model access and available quota. Check the development server output for provider errors without sharing secrets.
- **Wrong reply language:** Send a clear English or Urdu message; the reply should follow that language regardless of the interface toggle.
- **Unexpected saved context:** Use clear chat before starting an independent test.

## Tech stack

- Next.js 15 App Router, React, and TypeScript
- Tailwind CSS
- Vercel AI SDK: `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `@ai-sdk/google`, and `@ai-sdk/anthropic`
- `react-markdown`
- Browser local storage

## Coding-agent usage

I used Codex CLI as a coding assistant for implementation and refinement, frontend skills and Impeccable for UI design, and an `AGENTS.md` file to document project conventions and safety constraints.

I guided the agent with targeted prompts, including refining crisis detection to distinguish self-harm phrases from everyday activities such as cutting paper. I reviewed the generated changes and manually tested coaching and crisis scenarios.
