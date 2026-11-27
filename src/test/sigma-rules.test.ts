import { describe, expect, it } from 'vitest';
import { chatInput, feedbackInput, canRegenerate } from '@/lib/sigma';
describe('SigmaGPT rules',()=>{
  it('rejects empty messages and accepts questions',()=>{
    const conversationId='f0d8fa49-2934-44a5-9cc0-779e239a02c3';
    expect(chatInput.safeParse({conversationId,text:'   '}).success).toBe(false);
    expect(chatInput.parse({conversationId,text:'Explain recursion'}).text).toBe('Explain recursion');
  });
  it('only accepts like and dislike feedback',()=>{
    const messageId='f0d8fa49-2934-44a5-9cc0-779e239a02c3';
    expect(feedbackInput.parse({messageId,rating:1}).rating).toBe(1);
    expect(feedbackInput.parse({messageId,rating:-1}).rating).toBe(-1);
    expect(feedbackInput.safeParse({messageId,rating:0}).success).toBe(false);
  });
  it('only regenerates an existing assistant response',()=>{
    expect(canRegenerate([])).toBe(false);
    expect(canRegenerate([{role:'user'}])).toBe(false);
    expect(canRegenerate([{role:'user'},{role:'assistant'}])).toBe(true);
  });
});