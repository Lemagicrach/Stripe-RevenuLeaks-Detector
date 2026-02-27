import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// SSE stream for leak notifications (replaces client polling)
// Client: new EventSource('/api/leaks/stream')

export const runtime = 'nodejs'

function sseFormat(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const stripe_connection_id = searchParams.get('stripe_connection_id')

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastCursor = new Date(0).toISOString()
      controller.enqueue(encoder.encode(sseFormat('hello', { ok: true })))

      const interval = setInterval(async () => {
        try {
          let q = supabase
            .from('leak_notifications')
            .select('id, leak_id, leak_type, severity, title, message, channel, created_at, read_at')
            .eq('user_id', user.id)
            .eq('channel', 'in_app')
            .is('read_at', null)
            .gt('created_at', lastCursor)
            .order('created_at', { ascending: false })
            .limit(10)

          if (stripe_connection_id) q = q.eq('stripe_connection_id', stripe_connection_id)

          const { data, error } = await q
          if (error) return
          const items = data || []
          if (!items.length) return

          // Push newest first; update cursor
          lastCursor = items[0].created_at

          for (const n of items.reverse()) {
            controller.enqueue(encoder.encode(sseFormat('notification', n)))
          }

          // Mark as read (best-effort)
          const ids = items.map((x) => x.id)
          await supabase
            .from('leak_notifications')
            .update({ read_at: new Date().toISOString() })
            .in('id', ids)
        } catch {
          // ignore
        }
      }, 8_000)

      // Heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`))
        } catch {
          // ignore
        }
      }, 25_000)

      // Close on abort
      req.signal?.addEventListener?.('abort', () => {
        clearInterval(interval)
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // ignore
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
