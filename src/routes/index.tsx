import { createFileRoute } from "@tanstack/react-router";
import { ChatShell } from '@/components/chat-shell';
import { ChatWindow } from '@/components/chat-window';
import { pageMeta } from '@/lib/sigma';

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head:()=>pageMeta('Think smarter','SigmaGPT is your private AI workspace for ideas, code, writing, and learning. Think smarter. Create faster. Explore more.'),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <ChatShell><ChatWindow/></ChatShell>;
}
