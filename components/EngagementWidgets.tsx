'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

const notificationPool = [
  { name: 'Sarah', city: 'San Francisco', action: 'connected their Stripe account' },
  { name: 'Marcus', city: 'London', action: 'upgraded to Professional' },
  { name: 'Priya', city: 'Bangalore', action: 'signed up' },
  { name: 'Alex', city: 'Austin', action: 'connected their Stripe account' },
  { name: 'Daniel', city: 'Toronto', action: 'upgraded to Business' },
  { name: 'Isabella', city: 'Berlin', action: 'connected their Stripe account' },
]

function NotificationWidget() {
  const [current, setCurrent] = useState(notificationPool[0])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>
    let loopTimeout: ReturnType<typeof setTimeout>

    const show = (payload: typeof notificationPool[number]) => {
      setCurrent(payload)
      setVisible(true)
      hideTimeout = setTimeout(() => setVisible(false), 5000)
    }

    show(notificationPool[0])

    const schedule = () => {
      const delay = (30 + Math.random() * 30) * 1000
      loopTimeout = setTimeout(() => {
        const next = notificationPool[Math.floor(Math.random() * notificationPool.length)]
        show(next)
        schedule()
      }, delay)
    }

    schedule()

    return () => {
      clearTimeout(hideTimeout)
      clearTimeout(loopTimeout)
    }
  }, [])

  return (
    <div
      className={`fixed bottom-6 left-6 z-40 w-80 max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-xl transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold">
          {current.name[0]}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-900 font-semibold">
            {current.name} from {current.city}
          </p>
          <p className="text-sm text-gray-600">{current.action}</p>
        </div>
        <span className="text-xs text-gray-400">Just now</span>
      </div>
    </div>
  )
}

interface ChatMessage {
  from: 'agent' | 'user'
  text: string
}

function LiveChatWidget() {
  const [open, setOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: 'agent', text: "👋 Hi! Need help getting started? I'm here to answer any questions." },
  ])
  const [autoMessageSent, setAutoMessageSent] = useState(false)

  useEffect(() => {
    if (autoMessageSent) return

    const timer = setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { from: 'agent', text: "Quick question: What's your biggest challenge with tracking SaaS metrics?" },
      ])
      if (!open) {
        setHasUnread(true)
      }
      setAutoMessageSent(true)
    }, 30000)

    return () => clearTimeout(timer)
  }, [autoMessageSent, open])

  useEffect(() => {
    if (open) {
      setHasUnread(false)
    }
  }, [open])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim()) return

    const trimmed = input.trim()
    setMessages(prev => [
      ...prev,
      { from: 'user', text: trimmed },
      { from: 'agent', text: "Thanks! We'll get back to you within 2 hours." },
    ])
    setInput('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open ? (
        <div className="w-80 max-w-[90vw] mb-3 rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">RevPilot Live Chat</p>
              <p className="text-xs text-gray-500">We respond in under 2 hours</p>
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.map((message, idx) => (
              <div
                key={`${message.text}-${idx}`}
                className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded-xl ${
                    message.from === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500">We're away right now, but leave a message and we'll get back to you within 2 hours!</p>
          </div>
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 space-y-2">
            <input
              type="text"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask us anything..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">We typically reply within 2 hours.</span>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="relative flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-400 hover:bg-indigo-700 transition"
      >
        <span>Need help? Chat with us</span>
        {hasUnread ? (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" aria-hidden />
        ) : null}
      </button>
    </div>
  )
}

function ExitIntentModal() {
  const [open, setOpen] = useState(false)
  const hasShownRef = useRef(false)

  useEffect(() => {
    const hasSeen = typeof window !== 'undefined' && window.sessionStorage.getItem('revpilot-exit-intent') === 'seen'
    if (hasSeen) {
      hasShownRef.current = true
      return
    }

    const handleMouseLeave = (event: MouseEvent) => {
      if (hasShownRef.current) return

      const isLeavingWindow = event.clientY <= 12 && (!event.relatedTarget || (event.relatedTarget as Node)?.nodeName === 'HTML')
      if (!isLeavingWindow) return

      hasShownRef.current = true
      setOpen(true)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('revpilot-exit-intent', 'seen')
      }
    }

    document.addEventListener('mouseout', handleMouseLeave)
    return () => document.removeEventListener('mouseout', handleMouseLeave)
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOpen(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('revpilot-exit-intent', 'seen')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 relative">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          onClick={() => setOpen(false)}
          aria-label="Close exit intent"
        >
          X
        </button>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Wait! Before You Go...</h3>
        <p className="text-sm text-gray-600 mb-4">
          Get our free MRR calculator and learn how to track your metrics properly.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 text-white font-semibold py-3 hover:bg-indigo-700 transition"
          >
            Send Me the Calculator
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">No spam. Unsubscribe anytime. Used by 500+ founders.</p>
      </div>
    </div>
  )
}

export function EngagementWidgets() {
  return (
    <>
      <NotificationWidget />
      <LiveChatWidget />
      <ExitIntentModal />
    </>
  )
}
