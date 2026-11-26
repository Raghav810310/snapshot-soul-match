import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { pageMeta } from '@/lib/sigma';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SigmaLogo } from '@/components/sigma-logo';
export const Route=createFileRoute('/reset-password')({head:()=>pageMeta('Reset password','Securely set a new password for your SigmaGPT account.'),component:ResetPage});
function ResetPage(){
  const [valid,setValid]=useState(false);const [checking,setChecking]=useState(true);const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
  useEffect(()=>{const recovery=new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery';void supabase.auth.getUser().then(({data})=>{setValid(recovery&&!!data.user);setChecking(false);});},[]);
  async function submit(e:React.FormEvent){e.preventDefault();if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);setError('');const {error}=await supabase.auth.updateUser({password});if(error)setError(error.message);else setDone(true);setBusy(false);}
  return <div className="auth-page"><div className="auth-form"><SigmaLogo className="auth-mark"/><h1>{done?'Password updated':'Set a new password'}</h1>{checking?<p className="settings-info">Checking your reset link…</p>:done?<><p className="auth-subtitle">Your new password is ready.</p><Button asChild className="w-full"><Link to="/">Return to SigmaGPT</Link></Button></>:!valid?<><p className="auth-subtitle">This reset link is invalid or has expired. Request a new link to continue.</p><Button asChild className="w-full"><Link to="/auth">Back to sign in</Link></Button></>:<form className="space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="reset-password">New password</Label><Input id="reset-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></div><div className="space-y-2"><Label htmlFor="reset-confirm">Confirm new password</Label><Input id="reset-confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full">Update password</Button></form>}</div></div>;
}