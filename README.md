## Clone and install

```bash
git clone https://github.com/Priya-raja/parent-coach.git
cd parent-coach/parent-coach
npm install
```

Run these commands from the application folder containing `package.json`.

## Configure your API key

Create a file named `.env.local` alongside `package.json`.

Add **one** of the following:

**OpenAI**
```env
OPENAI_API_KEY=your_api_key_here
```

**Anthropic**
```env
ANTHROPIC_API_KEY=your_api_key_here
```

**Google Gemini**
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

The app selects a default model automatically. No model name is required.

If multiple keys are configured, the app uses Anthropic, Google Gemini and OpenAI.

Keep `.env.local` private and never commit it to GitHub.

## Start the app

```bash
npm run dev
```

Open http://localhost:3000.

Restart the development server whenever you change `.env.local`.
