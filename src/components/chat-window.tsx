import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import type { UIMessage, ChatStatus } from 'ai';
import { Lightbulb, Code2, Feather, FileText, ArrowUpRight, ArrowUp, X, Copy, RotateCcw, ThumbsUp, ThumbsDown, ShieldCheck, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit, PromptInputButton } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { createThread, rateMessage } from '@/lib/chat.functions';
import { supabase } from '@/integrations/supabase/client';
import { canRegenerate, type ChatRow } from '@/lib/sigma';
import { SigmaLogo } from './sigma-logo';
import { AuthForm } from './auth-form';
import { useAuth } from './auth-provider';

const suggestions=[
  {icon:Lightbulb,color:'text-idea',title:'Make the complex simple',text:'Explore a topic, one idea at a time.',prompt:'Explain quantum computing in simple terms, with a real-world analogy.'},
  {icon:Code2,color:'text-code',title:'Build something better',text:'Write, debug, and improve your code.',prompt:'Help me write a clean Python function that checks whether a string is a palindrome, with tests.'},
  {icon:Feather,color:'text-create',title:'Find your next big idea',text:'A fresh perspective for your writing.',prompt:'Give me five original ideas for a short science-fiction story.'},
  {icon:FileText,color:'text-summary',title:'Get to the essentials',text:'Less information. More understanding.',prompt:'Help me summarize a document. I will paste the text in my next message.'},
];
type DisplayMessage=UIMessage & {totalTokens?:number|null;model?:string|null;persisted?:boolean};
const toMessage=(row:ChatRow):DisplayMessage=>({id:row.id,role:row.role==='assistant'?'assistant':'user',parts:[{type:'text',text:row.content}],totalTokens:row.total_tokens,model:row.model,persisted:true});
export function ChatWindow({threadId,initialMessages=[],initialFeedback=[]}:{threadId?:string;initialMessages?:ChatRow[];initialFeedback?:{message_id:string;rating:number}[]}) {
  const {user}=useAuth();const navigate=useNavigate();const cache=useQueryClient();
  const create=useServerFn(createThread);const rate=useServerFn(rateMessage);
  const [messages,setMessages]=useState<DisplayMessage[]>(()=>initialMessages.map(toMessage));
  const [text,setText]=useState('');const [status,setStatus]=useState<ChatStatus>('ready');const [error,setError]=useState('');const [auth,setAuth]=useState(false);
  const [feedback,setFeedback]=useState<Record<string,number>>(()=>Object.fromEntries(initialFeedback.map(f=>[f.message_id,f.rating])));
  const [copied,setCopied]=useState('');const abort=useRef<AbortController|null>(null);const textarea=useRef<HTMLTextAreaElement|null>(null);const active=useRef(false);
  const isBusy=status==='submitted'||status==='streaming';
  const focus=useCallback(()=>{requestAnimationFrame(()=>textarea.current?.focus());},[]);
  const send=useCallback(async (input:string,regenerate=false)=>{
    if(active.current||!input.trim())return;
    if(!user){setAuth(true);return;}
    active.current=true;setStatus('submitted');setError('');
    try {
      if(!threadId) {
        const thread=await create({data:{text:input}});
        sessionStorage.setItem('sigma-pending',JSON.stringify({id:thread.id,text:input}));
        await cache.invalidateQueries({queryKey:['threads']});
        await navigate({to:'/chat/$threadId',params:{threadId:thread.id}});return;
      }
      const assistantId=`pending-${crypto.randomUUID()}`;
      if(!regenerate)setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',parts:[{type:'text',text:input}]}]);
      else setMessages(current=>current.slice(0,-1));
      setMessages(current=>[...current,{id:assistantId,role:'assistant',parts:[{type:'text',text:''}]}]);
      setText('');focus();
      const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error('Please sign in again.');
      abort.current=new AbortController();
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({conversationId:threadId,text:input,regenerate}),signal:abort.current.signal});
      if(!response.ok){const failure=await response.json();throw new Error(typeof failure.error==='string'?failure.error:'The request could not be completed.');}
      const reader=response.body?.getReader();if(!reader)throw new Error('Streaming is unavailable.');
      let buffer='';let complete=false;const decoder=new TextDecoder();
      for(;;){
        const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
        const frames=buffer.split('\n\n');buffer=frames.pop()??'';
        for(const frame of frames){
          if(!frame.startsWith('data: '))continue;
          const event=JSON.parse(frame.slice(6));
          if(event.type==='error')throw new Error(event.error);
          if(event.type==='delta') {setStatus('streaming');setMessages(current=>current.map(m=>m.id===assistantId?{...m,parts:[{type:'text',text:(m.parts.find(p=>p.type==='text')?.text??'')+event.text}]}:m));}
          if(event.type==='done'){complete=true;setMessages(current=>current.map(m=>m.id===assistantId?toMessage(event.message):m));}
        }
      }
      if(!complete)throw new Error('The response stopped before it could be saved.');
      await cache.invalidateQueries({queryKey:['threads']});
      await cache.invalidateQueries({queryKey:['thread',threadId]});
    } catch(e){
      if(e instanceof Error&&e.name==='AbortError')setError('Generation stopped. Any partial answer is not saved.');
      else {setError(e instanceof Error?e.message:'Something went wrong. Please try again.');setText(input);}
      setMessages(current=>current.filter(m=>m.parts.some(p=>p.type==='text'&&p.text.trim())));
    } finally{active.current=false;setStatus('ready');abort.current=null;focus();}
  },[user,threadId,create,cache,navigate,focus]);
  useEffect(()=>{focus();return()=>{abort.current?.abort();};},[focus]);
  useEffect(()=>{
    if(!threadId||!user)return;
    const pending=sessionStorage.getItem('sigma-pending');
    if(pending){try{const value=JSON.parse(pending);if(value.id===threadId){sessionStorage.removeItem('sigma-pending');void send(value.text);}}catch{sessionStorage.removeItem('sigma-pending');}}
  },[threadId,user,send]);
  async function vote(id:string,rating:1|-1){try{await rate({data:{messageId:id,rating}});setFeedback(v=>({...v,[id]:rating}));}catch(e){setError(e instanceof Error?e.message:'Could not save feedback.');}}
  async function copy(message:DisplayMessage){try{await navigator.clipboard.writeText(message.parts.filter(p=>p.type==='text').map(p=>p.text).join(''));setCopied(message.id);setTimeout(()=>setCopied(''),2000);}catch{setError('Clipboard access is unavailable.');}}
  const welcome=!messages.length;
  return <div className="chat-workspace">{welcome?<section className="welcome"><div className="welcome-inner"><SigmaLogo className="welcome-mark"/><div className="welcome-eyebrow"><span/>A space for your curiosity</div><h1>Hello! I’m SigmaGPT.<br/><em>What’s on your mind today?</em></h1><p className="welcome-subtitle">Think smarter. Create faster. Explore more.</p><div className="prompt-grid">{suggestions.map(s=><Button variant="ghost" key={s.title} className="prompt-card" onClick={()=>{setText(s.prompt);focus();}}><span className={`prompt-icon ${s.color}`}><s.icon/></span><ArrowUpRight className="prompt-arrow"/><strong>{s.title}</strong><p>{s.text}</p></Button>)}</div></div></section>:<Conversation className="chat-transcript"><ConversationContent className="chat-transcript-content">{messages.map((message,index)=><Message key={message.id} from={message.role} className="chat-message"><div className="message-label">{message.role==='assistant'?<><SigmaLogo/>SigmaGPT</>:<><span className="account-avatar">You</span>You</>}</div><MessageContent className="sigma-message-content">{message.parts.map((part,i)=>part.type==='text'?<MessageResponse key={i} isAnimating={isBusy&&index===messages.length-1}>{part.text}</MessageResponse>:null)}{isBusy&&index===messages.length-1&&!message.parts.some(p=>p.type==='text'&&p.text)&&<Shimmer>Thinking…</Shimmer>}</MessageContent>{message.role==='assistant'&&message.parts.some(p=>p.type==='text'&&p.text)&&!isBusy&&<MessageActions className="message-tools"><MessageAction tooltip={copied===message.id?'Copied':'Copy response'} onClick={()=>void copy(message)}><Copy/></MessageAction>{index===messages.length-1&&message.persisted&&canRegenerate(messages)&&<MessageAction tooltip="Regenerate response" onClick={()=>{const previous=messages[index-1];const input=previous?.parts.find(p=>p.type==='text')?.text;if(input)void send(input,true);}}><RotateCcw/></MessageAction>}{message.persisted&&<><MessageAction tooltip="Helpful" className={feedback[message.id]===1?'text-primary':''} onClick={()=>void vote(message.id,1)}><ThumbsUp/></MessageAction><MessageAction tooltip="Not helpful" className={feedback[message.id]===-1?'text-primary':''} onClick={()=>void vote(message.id,-1)}><ThumbsDown/></MessageAction></>}{message.totalTokens!=null&&<span className="message-usage">{message.totalTokens.toLocaleString()} tokens</span>}</MessageActions>}</Message>)}</ConversationContent><ConversationScrollButton/></Conversation>}
    <div className="composer-dock">{error&&<div className="composer-error" role="alert"><span>{error}</span><Button variant="ghost" size="icon-xs" aria-label="Dismiss error" onClick={()=>setError('')}><X/></Button></div>}<PromptInput className="sigma-composer" onSubmit={({text:input})=>send(input)}><PromptInputTextarea ref={textarea} value={text} onChange={e=>setText(e.target.value)} placeholder="Ask anything. Make it something great." aria-label="Message SigmaGPT" maxLength={30000} onKeyDown={e=>{if(isBusy&&e.key==='Enter'&&!e.shiftKey)e.preventDefault();}}/><PromptInputFooter><div className="flex items-center gap-1"><span className="composer-model"><SigmaLogo className="size-5"/>SigmaGPT<span/></span><TooltipModel/>{text&&<PromptInputButton tooltip="Clear input" aria-label="Clear input" onClick={()=>{setText('');focus();}}><X/></PromptInputButton>}</div><PromptInputSubmit className="composer-submit" status={status} disabled={!isBusy&&!text.trim()} onStop={()=>abort.current?.abort()}>{!isBusy?<ArrowUp/>:undefined}</PromptInputSubmit></PromptInputFooter></PromptInput><p className="composer-footnote">SigmaGPT can make mistakes. Double-check important information.</p></div>
    <Dialog open={auth} onOpenChange={setAuth}><DialogContent className="max-w-md py-10"><DialogTitle className="sr-only">Sign in to chat</DialogTitle><DialogDescription className="sr-only">Create an account or sign in to start chatting.</DialogDescription><AuthForm onSuccess={()=>{setAuth(false);focus();}}/></DialogContent></Dialog>
  </div>;
}
function TooltipModel(){return <span className="composer-model"><ShieldCheck size={12}/><span className="sr-only">Private conversation</span></span>;}