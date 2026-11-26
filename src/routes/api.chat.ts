import { createFileRoute } from '@tanstack/react-router';
import { chatInput, canRegenerate } from '@/lib/sigma';

export const Route = createFileRoute('/api/chat')({server:{handlers:{POST:async ({request})=>{
  const {createClient}=await import('@supabase/supabase-js');
  const {streamResponse,GatewayError}=await import('@lovable.dev/ai-gateway');
  const url=process.env['SUPABASE_URL'];const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
  if(!url||!key) return Response.json({error:'Account service is unavailable.'},{status:503});
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token) return Response.json({error:'Sign in to start a conversation.'},{status:401});
  const db=createClient<import('@/integrations/supabase/types').Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth.user) return Response.json({error:'Your session expired. Please sign in again.'},{status:401});
  const parsed=chatInput.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:'Enter a message of 1–30,000 characters.'},{status:400});
  const {conversationId,text,regenerate}=parsed.data;
  const {data:thread,error:threadError}=await db.from('conversations').select('id').eq('id',conversationId).eq('user_id',auth.user.id).single();
  if(threadError||!thread) return Response.json({error:'Conversation not found.'},{status:404});
  const history:import('@/lib/sigma').ChatRow[]=[];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('messages').select('*').eq('conversation_id',conversationId).order('created_at').order('id').range(offset,offset+999);
    if(error) return Response.json({error:'Could not read conversation.'},{status:500});
    history.push(...data);if(data.length<1000) break;
  }
  const previous=regenerate?history.at(-1):undefined;
  if(regenerate&&!canRegenerate(history)) return Response.json({error:'There is no response to regenerate.'},{status:400});
  if(regenerate) history.pop();
  else {
    const {data,error}=await db.from('messages').insert({conversation_id:conversationId,role:'user',content:text}).select().single();
    if(error) return Response.json({error:'Could not save your message.'},{status:500});
    history.push(data);
  }
  const model=process.env['AI_MODEL']??'openai/gpt-6-astra';
  if(model!=='openai/gpt-6-astra'&&model!=='openai/gpt-6.1-terra') return Response.json({error:'The configured AI model is not supported.'},{status:503});
  const abort=new AbortController();
  request.signal.addEventListener('abort',()=>abort.abort(),{once:true});
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    async start(controller) {
      let content='';let complete=false;let totalTokens:number|null=null;
      const emit=(value:unknown)=>{if(!abort.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));};
      try {
        const input=history.map(m=>({role:m.role==='assistant'?'assistant' as const:'user' as const,content:m.content}));
        const instructions='You are SigmaGPT, a helpful, thoughtful AI assistant. Help with learning, coding, creative writing, summarization and translation. Use clear Markdown, fenced code with language tags, and accurate explanations. Preserve conversation context. Be honest about uncertainty. Never claim to have searched the web or accessed files unless their content was provided.';
        const result=await streamResponse({model,input,instructions},{signal:abort.signal});
        for await(const event of result) {
          if(event.type==='response.output_text.delta'||event.type==='response.refusal.delta'){content+=event.delta;emit({type:'delta',text:event.delta});}
          if(event.type==='response.completed'){complete=true;totalTokens=event.response.usage?.total_tokens??null;}
          if(event.type==='response.incomplete') throw new Error('The response ended before completion. Please try again.');
        }
        if(complete&&content&&!abort.signal.aborted) {
          const values={content,total_tokens:totalTokens,model};
          const saved=previous?await db.from('messages').update(values).eq('id',previous.id).eq('conversation_id',conversationId).select().single():await db.from('messages').insert({...values,conversation_id:conversationId,role:'assistant'}).select().single();
          if(saved.error) throw new Error('Your response could not be saved. Copy it before leaving this page.');
          emit({type:'done',message:saved.data});
        } else if(!abort.signal.aborted) throw new Error('No completed answer was received. Please try again.');
      } catch(error) {
        if(!abort.signal.aborted) {
          let message='The answer could not be completed. Your message is saved; you can try again.';
          if(error instanceof GatewayError) {
            console.error('SigmaGPT AI failure',{code:error.code,ids:error.ids});
            if(error.httpStatus===402) message='AI credits are unavailable. The workspace owner can add credits to continue.';
            if(error.httpStatus===429) message='AI is busy right now. Please wait a moment before trying again.';
            if(error.httpStatus===403) message='This AI model is unavailable under the workspace access policy.';
          } else if(error instanceof Error) message=error.message;
          emit({type:'error',error:message});
        }
      } finally {try{controller.close();}catch{/* Reader already cancelled. */}}
    },cancel(){abort.abort();}
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store','X-Content-Type-Options':'nosniff'}});
}}}});