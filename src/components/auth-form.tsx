import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SigmaLogo } from './sigma-logo';
import { ArrowRight, LoaderCircle } from 'lucide-react';

export function AuthForm({onSuccess}:{onSuccess?:()=>void}) {
  const [mode,setMode]=useState<'login'|'signup'|'forgot'>('login');
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState('');
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
  const navigate=useNavigate();
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      if(mode==='forgot') {
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});
        if(error) throw error;setNotice('Check your email for a password reset link.');
      } else if(mode==='signup') {
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:window.location.origin}});
        if(error) throw error;
        if(data.session) {onSuccess?.();await navigate({to:'/'});} else setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const {error}=await supabase.auth.signInWithPassword({email,password});if(error) throw error;
        onSuccess?.();await navigate({to:'/'});
      }
    } catch(e) {setError(e instanceof Error?e.message:'Could not complete sign-in.');} finally {setBusy(false);}
  }
  return <div className="auth-form"><SigmaLogo className="auth-mark"/><h1>{mode==='signup'?'Create your account':mode==='forgot'?'Reset your password':'Welcome to SigmaGPT'}</h1><p className="auth-subtitle">{mode==='signup'?'Your next great idea starts here.':mode==='forgot'?'A fresh start, one email away.':'A little curiosity. Endless possibilities.'}</p><form onSubmit={submit} className="space-y-5">
    {mode==='signup'&&<div className="space-y-2"><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></div>}
    <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></div>
    {mode!=='forgot'&&<div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode==='signup'?'new-password':'current-password'}/></div>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-success">{notice}</p>}
    <Button className="w-full" size="lg" disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<ArrowRight/>}{mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Sign in'}</Button>
    </form><div className="auth-links">{mode==='login'&&<Button variant="link" onClick={()=>{setMode('forgot');setError('');setNotice('');}}>Forgot password?</Button>}<Button variant="link" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setNotice('');}}>{mode==='login'?'Create an account':'Back to sign in'}</Button></div><p className="auth-privacy">Your conversations stay private to your account.</p></div>;
}