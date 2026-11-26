import { createFileRoute, Link } from '@tanstack/react-router';
import { AuthForm } from '@/components/auth-form';
import { pageMeta } from '@/lib/sigma';
import { ArrowLeft } from 'lucide-react';
export const Route=createFileRoute('/auth')({head:()=>pageMeta('Your account','Sign in or create your SigmaGPT account to start a private conversation.'),component:AuthPage});
function AuthPage(){return <div className="auth-page"><Link to="/" className="absolute top-7 left-7 flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft size={14}/>Back to SigmaGPT</Link><AuthForm/></div>;}