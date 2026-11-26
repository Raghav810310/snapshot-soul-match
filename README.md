# SigmaGPT

**Think Smarter. Create Faster. Explore More.**

A final-year B.Tech Computer Science conversational AI project for learning, coding, writing, summarization, and translation.

## Stack
React 19, TypeScript, TanStack Start/Router, Vite, Tailwind CSS v4, shadcn/ui, Lucide, AI Elements, Streamdown, TanStack Query, Lovable Cloud authentication and PostgreSQL, and Lovable AI Gateway SDK with OpenAI models.

The project uses TanStack Start's server runtime rather than separate Edge Functions. The user selected built-in Lovable AI instead of supplying a personal OpenAI API key.

## Features
- Email/password registration, confirmation, login, logout, and password recovery.
- Private account-owned conversations with dedicated URLs, rename, delete, save, and title search.
- Full-history contextual AI, streaming, stop, and regeneration.
- Markdown, syntax-highlighted code, copy, likes/dislikes, and real token usage when returned.
- Prompt starters, multiline composer, automatic scrolling, and mobile sidebar.
- Profile editing, password changes, light/dark appearance, and confirmed history deletion.
- No fabricated replies, usage, or history.

## Architecture
```text
Welcome / account form → Cloud authentication
    → Protected /chat/:threadId and /settings
    → Authenticated server functions → PostgreSQL + owner-scoped RLS

Composer → POST /api/chat → validate bearer and ownership
    → load complete ordered history → OpenAI via Lovable AI SDK
    → adapt streamed events to UIMessage text parts
    → persist completed assistant response → show confirmed saved row
```
The chat handler authenticates independently of page access. Ordinary account operations use the signed-in user's client with RLS, never privileged database access. Only completed answers are saved. Stopped/failed partial text remains visible with a warning. Regeneration replaces the latest assistant row only after successful completion.

## Database schema
| Table | Fields | Access |
| --- | --- | --- |
| profiles | id, full_name, email, created_at | Own account only; auto-created on signup |
| conversations | id, user_id, title, saved, timestamps | Owner only |
| messages | id, conversation_id, role, content, total_tokens, model, created_at | Conversation owner only |
| feedback | id, user_id, message_id, rating, created_at | Own rating on an owned assistant message |

Migrations are in `drizzle/migrations`. Cascades remove messages and feedback when a conversation is deleted. Every table has explicit grants and RLS.

## Local development
Install Bun, clone the repository, and run:
```sh
bun install
bun run dev
```
Use `.env.example` for your uncommitted local configuration. Public browser configuration and server `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are supplied by the connected Cloud environment. Never commit keys or secret-bearing environment files. Managed privileged credentials are not needed in frontend code.
```sh
bun run test
bun run lint
bun run build
```

## AI setup
Lovable manages `LOVABLE_API_KEY` securely. Calls use workspace AI credits; no separate OpenAI account or `OPENAI_API_KEY` is required. The server model defaults to `openai/gpt-6-astra`. Set the server-only `AI_MODEL` secret to `openai/gpt-6.1-terra` for the other generated contract. Workspace access and retention policies still apply. Unsupported model configuration fails safely instead of silently switching providers.

To add another model, discover workspace availability with `listModels()`, generate its SDK contract, and update the server allowlist and request types. Keep inference and secrets server-side. Browser storage contains only appearance and a short-lived new-chat handoff, not saved conversation history.

## Authentication setup
Email sign-in is enabled. Confirmation remains on; registration displays a check-email state until confirmation. Password reset returns to `/reset-password`. Configure allowed redirects in Lovable's Users → Auth settings for new custom domains. Recovery requires a valid email link.

## Deployment
Publish from Lovable after checking the app and AI credit availability. Cloud migrations and secrets are managed separately from the public client bundle. Connect GitHub in Lovable for source synchronization. This app targets the managed Worker runtime; do not externalize server dependencies or deploy as a static-only site.

## Screenshots
Capture the welcome workspace, a real conversation, mobile navigation, and settings from the running app for the project report. Screenshots and demonstration history are not fabricated.

## Tests
Rule tests cover input, feedback, and regeneration. Routing tests verify the index. Browser verification must also exercise real signed-in streaming, reload restoration across two conversation URLs, ownership isolation, and mobile usability.
