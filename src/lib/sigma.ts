import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ChatRow = Database['public']['Tables']['messages']['Row'];
export type Thread = Database['public']['Tables']['conversations']['Row'];
export const chatInput = z.object({ conversationId: z.uuid(), text: z.string().trim().min(1).max(30000), regenerate: z.boolean().default(false) });
export const feedbackInput = z.object({ messageId: z.uuid(), rating: z.union([z.literal(1), z.literal(-1)]) });
export function conversationTitle(text: string) { return text.trim().replace(/\s+/g, ' ').slice(0, 70) || 'New conversation'; }
export function canRegenerate(rows: { role: string }[]) { return rows.at(-1)?.role === 'assistant'; }
export function pageMeta(title: string, description: string) {
  return { meta: [{title: `${title} · SigmaGPT`}, {name:'description',content:description}, {property:'og:title',content:`${title} · SigmaGPT`}, {property:'og:description',content:description}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary_large_image'}] };
}