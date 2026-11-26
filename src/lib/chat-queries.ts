import { queryOptions } from '@tanstack/react-query';
import { readThread, listThreads, profileData } from './chat.functions';
export const threadQuery = (id:string) => queryOptions({queryKey:['thread',id],queryFn:()=>readThread({data:{id}})});
export const threadsQuery = () => queryOptions({queryKey:['threads'],queryFn:()=>listThreads()});
export const profileQuery = () => queryOptions({queryKey:['profile'],queryFn:()=>profileData()});