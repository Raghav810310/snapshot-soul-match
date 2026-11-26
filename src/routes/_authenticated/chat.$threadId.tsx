import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { threadQuery } from '@/lib/chat-queries';
import { ChatShell } from '@/components/chat-shell';
import { ChatWindow } from '@/components/chat-window';
import { pageMeta } from '@/lib/sigma';
export const Route=createFileRoute('/_authenticated/chat/$threadId')({head:()=>pageMeta('Conversation','Your private SigmaGPT conversation. Learn, create, and explore with contextual AI.'),loader:({context,params})=>context.queryClient.ensureQueryData(threadQuery(params.threadId)),component:ChatPage});
function ChatPage(){const {threadId}=Route.useParams();const {data}=useSuspenseQuery(threadQuery(threadId));return <ChatShell threadId={threadId} title={data.thread.title}><ChatWindow key={threadId} threadId={threadId} initialMessages={data.messages} initialFeedback={data.feedback}/></ChatShell>;}