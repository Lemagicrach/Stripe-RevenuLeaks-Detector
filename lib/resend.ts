export type SendEmailArgs = {
  to: string
  subject: string
  html: string
}

/**
 * Minimal Resend wrapper.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL.
 */
export async function sendViaResend({ to, subject, html }: SendEmailArgs): Promise<{ id?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error('Email not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.')
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Failed to send email: ${resp.status} ${text}`)
  }

  const j = await resp.json().catch(() => null)
  return { id: j?.id }
}
