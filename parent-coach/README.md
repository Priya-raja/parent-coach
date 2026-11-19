Here is the complete, professional `README.md` tailored for your submission. Replace the entire default file with this.

***

```markdown
# Parent Coach

A bilingual (English/Urdu) AI parenting coach built with Next.js 15, Tailwind CSS, and the Vercel AI SDK. 

## Features
- **Safety First:** A pre-LLM crisis gate checks every message for self-harm, abuse, or emergency keywords (in English, Urdu, and Roman Urdu). If triggered, it bypasses the AI entirely and serves a hardcoded, human-reviewed escalation message with helpline numbers.
- **Child Development Persona:** Uses a two-phase "Discovery" system prompt. It acts like a warm, analytical teacher—validating the goal, sharing a developmental insight, and asking for the child's name, age, and context *before* giving a structured plan.
- **Scheduled Follow-ups:** Database-free scheduling using the Vercel AI SDK tool calling and `localStorage`. The coach can ask to check back later, remember the child's name, and generate a personalized follow-up message when the time comes.
- **Bilingual UI:** Full RTL support with a smooth EN/UR toggle. The UI direction, fonts, and AI responses all adapt dynamically.
- **Model-Agnostic:** Supports Anthropic, Google Gemini, and OpenAI out of the box.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your API key:**
   Create a `.env.local` file in the root directory and add **one** of the following keys:
   ```env
   # Option 1: Anthropic (Claude)
   ANTHROPIC_API_KEY=sk-ant-...

   # Option 2: Google Gemini (Free tier available at https://aistudio.google.com/apikey)
   GOOGLE_GENERATIVE_AI_API_KEY=AIza...

   # Option 3: OpenAI
   OPENAI_API_KEY=sk-...
   ```
   *The app checks for the Anthropic key first, then the Google key, then the OpenAI key.*

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing the Safety Gate
To verify the pre-LLM crisis gate works, try sending one of these messages:
- English: *"I want to end it all"*
- Urdu: *"میرے شوہر بچے کو مارتے ہیں"* (My husband hits the child)

You will immediately see a hardcoded helpline message and no AI generation.

## Tech Stack
- Next.js 15 (App Router)
- Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic`)
- Tailwind CSS
- `react-markdown` for rendering AI responses

## Note on Development
This project was built using Codex as the primary coding agent, supported by custom `.agents/skills` (design philosophy and strict React rules) to enforce UI quality and edge-case handling. GitHub Copilot was used for initial scaffolding.
```
