import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { conversationTitle, feedbackInput } from './sigma';

export const listThreads = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data,error} = await context.supabase.from('conversations').select('*').eq('user_id',context.userId).order('updated_at',{ascending:false});
  if(error) throw new Error('Could not load conversations');
  return data;
});
export const createThread = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({text:z.string().max(30000)})).handler(async ({context,data}) => {
  const result = await context.supabase.from('conversations').insert({user_id:context.userId,title:conversationTitle(data.text)}).select().single();
  if(result.error) throw new Error('Could not create conversation');
  return result.data;
});
export const readThread = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.uuid()})).handler(async ({context,data}) => {
  const thread = await context.supabase.from('conversations').select('*').eq('id',data.id).eq('user_id',context.userId).single();
  if(thread.error) throw new Error('Conversation not found');
  const messages = [];
  for(let offset=0;;offset+=1000) {
    const result = await context.supabase.from('messages').select('*').eq('conversation_id',data.id).order('created_at').order('id').range(offset,offset+999);
    if(result.error) throw new Error('Could not load messages');
    messages.push(...result.data);
    if(result.data.length<1000) break;
  }
  const feedback = await context.supabase.from('feedback').select('message_id,rating').eq('user_id',context.userId);
  if(feedback.error) throw new Error('Could not load feedback');
  return {thread:thread.data,messages,feedback:feedback.data};
});
export const updateThread = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.uuid(),title:z.string().trim().min(1).max(100).optional(),saved:z.boolean().optional(),remove:z.boolean().optional()})).handler(async ({context,data}) => {
  const query = data.remove ? context.supabase.from('conversations').delete() : context.supabase.from('conversations').update({...(data.title!==undefined?{title:data.title}:{}),...(data.saved!==undefined?{saved:data.saved}:{}),updated_at:new Date().toISOString()});
  const {error} = await query.eq('id',data.id).eq('user_id',context.userId);
  if(error) throw new Error('Could not update conversation');
  return {ok:true};
});
export const rateMessage = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(feedbackInput).handler(async ({context,data}) => {
  const {error} = await context.supabase.from('feedback').upsert({user_id:context.userId,message_id:data.messageId,rating:data.rating},{onConflict:'user_id,message_id'});
  if(error) throw new Error('Could not save feedback');
  return {ok:true};
});
export const clearHistory = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {error} = await context.supabase.from('conversations').delete().eq('user_id',context.userId);
  if(error) throw new Error('Could not clear history');
  return {ok:true};
});
export const profileData = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const {data,error} = await context.supabase.from('profiles').select('*').eq('id',context.userId).single();
  if(error) throw new Error('Could not load profile');
  return data;
});
export const saveProfile = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({full_name:z.string().trim().min(1).max(100)})).handler(async ({context,data}) => {
  const {error} = await context.supabase.from('profiles').update(data).eq('id',context.userId);
  if(error) throw new Error('Could not save profile');
  return {ok:true};
});