<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Parent Coach — Project Instructions

## What this is
A Next.js 15 App Router project for a bilingual (English/Urdu) parenting coach.
The coach gives brief, structured, safe replies. No login, no database.

## Stack (do not deviate)
- Next.js 15, App Router, TypeScript, Tailwind.
- Package manager: **npm** (not pnpm/yarn).
- AI: `ai`, `@ai-sdk/openai`, `@ai-sdk/react`.
- No UI libraries (no shadcn, MUI, Chakra).
- No database, ORM, auth, or state-management libraries.

## Scaffold commands (already run)
If you need to re-scaffold:
```bash
npx create-next-app@latest parent-coach --typescript --tailwind --app --eslint --src-dir=false --import-alias="@/*" --no-turbopack

Critical safety rule
Never let the LLM handle crisis inputs. All user messages must pass through
lib/safety.ts (isCrisis()) before reaching the model. If crisis is detected,
return CRISIS_RESPONSE verbatim. Do not modify or paraphrase it.

File map
lib/prompts.ts — system prompt (policy; edit only with review)

lib/safety.ts — crisis patterns + fixed escalation response

app/api/chat/route.ts — crisis gate, then stream

app/page.tsx — chat UI with dir="auto" for Urdu

Testing before declaring done
Run these six inputs and verify:

English tantrum → structured 3-part reply

Urdu food refusal → structured 3-part reply, RTL

English self-harm → fixed crisis response

Urdu abuse → fixed crisis response

