
import { createFileRoute } from '@tanstack/react-router';
import { chatInput, canRegenerate } from '@/lib/sigma';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env['SUPABASE_URL'];
        const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
        const groqKey = process.env['GROQ_API_KEY'];

        if (!url || !key || !groqKey) {
          return Response.json(
            { error: 'Required API configuration is missing.' },
            { status: 503 }
          );
        }

        const groq = new OpenAI({
          apiKey: groqKey,
          baseURL: 'https://api.groq.com/openai/v1',
        });

        const token = request.headers
          .get('authorization')
          ?.replace(/^Bearer /, '');

        if (!token) {
          return Response.json(
            { error: 'Sign in to start a conversation.' },
            { status: 401 }
          );
        }

        const db = createClient<
          import('@/integrations/supabase/types').Database
        >(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        });

        const { data: auth, error: authError } =
          await db.auth.getUser(token);

        if (authError || !auth.user) {
          return Response.json(
            { error: 'Your session expired. Please sign in again.' },
            { status: 401 }
          );
        }

        const parsed = chatInput.safeParse(
          await request.json().catch(() => null)
        );

        if (!parsed.success) {
          return Response.json(
            { error: 'Enter a message of 1–30,000 characters.' },
            { status: 400 }
          );
        }

        const { conversationId, text, regenerate } = parsed.data;

        const { data: thread, error: threadError } = await db
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .eq('user_id', auth.user.id)
          .single();

        if (threadError || !thread) {
          return Response.json(
            { error: 'Conversation not found.' },
            { status: 404 }
          );
        }

        const history: import('@/lib/sigma').ChatRow[] = [];

        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await db
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at')
            .order('id')
            .range(offset, offset + 999);

          if (error) {
            return Response.json(
              { error: 'Could not read conversation.' },
              { status: 500 }
            );
          }

          history.push(...data);
          if (data.length < 1000) break;
        }

        const previous = regenerate ? history.at(-1) : undefined;

        if (regenerate && !canRegenerate(history)) {
          return Response.json(
            { error: 'There is no response to regenerate.' },
            { status: 400 }
          );
        }

        if (regenerate) {
          history.pop();
        } else {
          const { data, error } = await db
            .from('messages')
            .insert({
              conversation_id: conversationId,
              role: 'user',
              content: text,
            })
            .select()
            .single();

          if (error) {
            return Response.json(
              { error: 'Could not save your message.' },
              { status: 500 }
            );
          }

          history.push(data);
        }

        const model = 'openai/gpt-oss-20b';
        const abort = new AbortController();

        request.signal.addEventListener(
          'abort',
          () => abort.abort(),
          { once: true }
        );

        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let content = '';
            let complete = false;
            let totalTokens: number | null = null;

            const emit = (value: unknown) => {
              if (!abort.signal.aborted) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(value)}\n\n`)
                );
              }
            };

            try {
              const instructions =
                'You are SigmaGPT, a helpful, thoughtful AI assistant. Help with learning, coding, creative writing, summarization and translation. Use clear Markdown, fenced code with language tags, and accurate explanations. Preserve conversation context. Be honest about uncertainty. Never claim to have searched the web or accessed files unless their content was provided.';

              const messages = [
                {
                  role: 'system' as const,
                  content: instructions,
                },
                ...history.map((m) => ({
                  role: m.role === 'assistant'
                    ? 'assistant' as const
                    : 'user' as const,
                  content: m.content,
                })),
              ];

              const result = await groq.chat.completions.create(
                {
                  model,
                  messages,
                  stream: true,
                  stream_options: { include_usage: true },
                },
                { signal: abort.signal }
              );

              for await (const chunk of result) {
                const delta = chunk.choices[0]?.delta?.content;

                if (typeof delta === 'string' && delta.length > 0) {
                  content += delta;
                  emit({ type: 'delta', text: delta });
                }

                if (chunk.choices[0]?.finish_reason) {
                  complete = true;
                }

                if (chunk.usage) {
                  totalTokens = chunk.usage.total_tokens;
                }
              }

              if (complete && content && !abort.signal.aborted) {
                const values = {
                  content,
                  total_tokens: totalTokens,
                  model,
                };

                const saved = previous
                  ? await db
                      .from('messages')
                      .update(values)
                      .eq('id', previous.id)
                      .eq('conversation_id', conversationId)
                      .select()
                      .single()
                  : await db
                      .from('messages')
                      .insert({
                        ...values,
                        conversation_id: conversationId,
                        role: 'assistant',
                      })
                      .select()
                      .single();

                if (saved.error) {
                  throw new Error('Your response could not be saved.');
                }

                emit({ type: 'done', message: saved.data });
              } else if (!abort.signal.aborted) {
                throw new Error('No completed answer was received.');
              }
            } catch (error) {
              if (!abort.signal.aborted) {
                console.error('SigmaGPT Groq failure', error);

                emit({
                  type: 'error',
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Groq request failed. Check the server terminal.',
                });
              }
            } finally {
              try {
                controller.close();
              } catch {
                // Reader already cancelled.
              }
            }
          },

          cancel() {
            abort.abort();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      },
    },
  },
});
