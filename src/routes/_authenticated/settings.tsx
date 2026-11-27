import { createFileRoute } from '@tanstack/react-router';
import { profileQuery } from '@/lib/chat-queries';
import { pageMeta } from '@/lib/sigma';
import { SettingsPanel } from '@/components/settings-panel';
export const Route=createFileRoute('/_authenticated/settings')({head:()=>pageMeta('Settings','Manage your SigmaGPT profile, security, appearance, and private conversation history.'),loader:({context})=>context.queryClient.ensureQueryData(profileQuery()),component:SettingsPanel});