import { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Search, SquarePen, Bookmark, MessageSquare, Settings, PanelLeftClose, Menu, ChevronDown, MoreHorizontal, Pencil, Trash2, LogOut, ShieldCheck, ArrowUpRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { threadsQuery } from '@/lib/chat-queries';
import { updateThread } from '@/lib/chat.functions';
import { supabase } from '@/integrations/supabase/client';
import { SigmaLogo } from './sigma-logo';
import { useAuth } from './auth-provider';
import { AuthForm } from './auth-form';
import type { Thread } from '@/lib/sigma';

export function IconButton({label,children,onClick}:{label:string;children:ReactNode;onClick:()=>void}) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
export function ChatShell({children,threadId,title='New conversation'}:{children:ReactNode;threadId?:string;title?:string}) {
  const {user}=useAuth();const navigate=useNavigate();const cache=useQueryClient();
  const threads=useQuery({...threadsQuery(),enabled:!!user});
  const update=useServerFn(updateThread);
  const [mobile,setMobile]=useState(false);const [collapsed,setCollapsed]=useState(false);const [auth,setAuth]=useState(false);
  const [search,setSearch]=useState(false);const [query,setQuery]=useState('');const [savedOnly,setSavedOnly]=useState(false);
  const [rename,setRename]=useState<Thread|null>(null);const [newTitle,setNewTitle]=useState('');const [removing,setRemoving]=useState<Thread|null>(null);const [busy,setBusy]=useState(false);const [actionError,setActionError]=useState('');
  const displayName=typeof user?.user_metadata['full_name']==='string'?user.user_metadata['full_name']:user?.email?.split('@')[0]??'Guest';
  async function logout() {await cache.cancelQueries();cache.clear();await supabase.auth.signOut();await navigate({to:'/auth',replace:true});}
  async function mutate(thread:Thread,data:{title?:string;saved?:boolean;remove?:boolean}) {
    setBusy(true);setActionError('');
    try {await update({data:{id:thread.id,...data}});await cache.invalidateQueries({queryKey:['threads']});await cache.invalidateQueries({queryKey:['thread',thread.id]});setRename(null);setRemoving(null);if(data.remove&&threadId===thread.id) await navigate({to:'/'});}
    catch(e){setActionError(e instanceof Error?e.message:'Could not update conversation');}finally{setBusy(false);}
  }
  function openNew(){setMobile(false);void navigate({to:'/'});}
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setSearch(true);}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='o'){e.preventDefault();void navigate({to:'/'});}};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[navigate]);
  const visible=(threads.data??[]).filter(t=>(!savedOnly||t.saved)&&t.title.toLowerCase().includes(query.toLowerCase()));
  const sidebar=(mobileVersion=false)=><aside className={`sidebar ${mobileVersion?'mobile-sidebar':''}`}>
    <Link to="/" className="sidebar-brand"><SigmaLogo/><span>SigmaGPT</span><span className="brand-beta">BETA</span></Link>
    <Button variant="outline" className="new-chat" onClick={openNew}><span><SquarePen size={16}/>New chat</span><span className="keycap">⌘ ⇧ O</span></Button>
    <nav className="sidebar-nav"><Button variant="ghost" className="nav-control" onClick={()=>setSearch(true)}><Search/>Search conversations<span className="keycap ml-auto">⌘ K</span></Button><Button variant="ghost" className={`nav-control ${savedOnly?'active':''}`} onClick={()=>setSavedOnly(v=>!v)}><Bookmark/>{savedOnly?'All conversations':'Saved conversations'}</Button></nav>
    <div className="thread-list"><div className="section-label"><span>{savedOnly?'Saved':'Recent conversations'}</span><MessageSquare size={12}/></div>
      {threads.isError?<p className="thread-empty">Couldn’t load chats. <Button variant="link" onClick={()=>void threads.refetch()}>Retry</Button></p>:visible.length===0?<p className="thread-empty">{threads.isLoading?'Loading…':savedOnly?'No saved conversations':'No conversations yet'}</p>:visible.map(t=><div className={`thread-row ${t.id===threadId?'active':''}`} key={t.id}><Button variant="ghost" className="thread-select" onClick={()=>{setMobile(false);void navigate({to:'/chat/$threadId',params:{threadId:t.id}});}}><MessageSquare className="shrink-0"/><span>{t.title}</span></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`Options for ${t.title}`} className="thread-menu"><MoreHorizontal/></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={()=>{setRename(t);setNewTitle(t.title);setActionError('');}}><Pencil/>Rename</DropdownMenuItem><DropdownMenuItem onClick={()=>void mutate(t,{saved:!t.saved})}><Bookmark/>{t.saved?'Unsave':'Save conversation'}</DropdownMenuItem><DropdownMenuItem onClick={()=>{setRemoving(t);setActionError('');}}><Trash2/>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}
    </div>
    <div className="sidebar-bottom"><Button variant="ghost" className="nav-control w-full" onClick={()=>user?void navigate({to:'/settings'}):setAuth(true)}><Settings/>Settings</Button>
      {user?<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="account-control"><span className="account-avatar">{displayName.slice(0,2).toUpperCase()}</span><span className="account-copy"><strong>{displayName}</strong><small>Personal account</small></span><ChevronDown className="ml-auto"/></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={()=>void navigate({to:'/settings'})}><Settings/>Your account</DropdownMenuItem><DropdownMenuItem onClick={()=>void logout()}><LogOut/>Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>:<Button variant="ghost" className="account-control" onClick={()=>setAuth(true)}><span className="account-avatar"><SigmaLogo className="size-7"/></span><span className="account-copy"><strong>Make yourself at home</strong><small>Sign in to SigmaGPT</small></span><ArrowUpRight className="ml-auto"/></Button>}
    </div>
  </aside>;
  return <div className="sigma-app">{!collapsed&&sidebar()}<main className="main-panel"><header className="chat-topbar"><div className="topbar-title"><div className="mobile-menu"><IconButton label="Open sidebar" onClick={()=>setMobile(true)}><Menu/></IconButton></div><span className="hidden md:inline-flex"><IconButton label={collapsed?'Open sidebar':'Close sidebar'} onClick={()=>setCollapsed(v=>!v)}><PanelLeftClose/></IconButton></span><strong>SigmaGPT</strong><div className="topbar-divider"/><span>{title}</span></div><div className="topbar-right"><span className="private-label"><ShieldCheck/>Private workspace</span>{!user&&<Button variant="outline" size="sm" onClick={()=>setAuth(true)}>Sign in <ArrowUpRight/></Button>}</div></header>{children}</main>
    <Sheet open={mobile} onOpenChange={setMobile}><SheetContent side="left" className="w-[280px] p-0 border-border"><SheetTitle className="sr-only">Conversations</SheetTitle>{sidebar(true)}</SheetContent></Sheet>
    <Dialog open={auth} onOpenChange={setAuth}><DialogContent className="max-w-md py-10"><DialogTitle className="sr-only">Sign in to SigmaGPT</DialogTitle><DialogDescription className="sr-only">Access your private conversations.</DialogDescription><AuthForm onSuccess={()=>setAuth(false)}/></DialogContent></Dialog>
    <Dialog open={search} onOpenChange={setSearch}><DialogContent><DialogTitle>Search conversations</DialogTitle><DialogDescription className="sr-only">Find a conversation by its title.</DialogDescription><div className="flex items-center gap-2"><Search size={18}/><Input autoFocus placeholder="Search your conversations…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="Clear search" onClick={()=>setQuery('')}><X/></IconButton>}</div><div className="max-h-80 overflow-auto">{visible.map(t=><Button key={t.id} variant="ghost" className="w-full justify-start" onClick={()=>{setSearch(false);setQuery('');void navigate({to:'/chat/$threadId',params:{threadId:t.id}});}}><MessageSquare/><span className="truncate">{t.title}</span></Button>)}{!visible.length&&<p className="py-6 text-center text-sm text-muted-foreground">No conversations found</p>}</div></DialogContent></Dialog>
    <Dialog open={!!rename} onOpenChange={v=>{if(!v)setRename(null);}}><DialogContent><DialogTitle>Rename conversation</DialogTitle><DialogDescription className="sr-only">Choose a new title.</DialogDescription><form className="rename-form" onSubmit={e=>{e.preventDefault();if(rename)void mutate(rename,{title:newTitle});}}><Input aria-label="Conversation title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} required maxLength={100}/>{actionError&&<p role="alert" className="text-destructive text-sm">{actionError}</p>}<Button disabled={busy}>Save title</Button></form></DialogContent></Dialog>
    <Dialog open={!!removing} onOpenChange={v=>{if(!v)setRemoving(null);}}><DialogContent><DialogTitle>Delete conversation?</DialogTitle><DialogDescription>This permanently deletes “{removing?.title}” and its messages.</DialogDescription>{actionError&&<p role="alert" className="text-destructive text-sm">{actionError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={()=>{if(removing)void mutate(removing,{remove:true});}}>Delete conversation</Button></div></DialogContent></Dialog>
  </div>;
}