import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import OpenAI from 'openai'

let supabaseAdminClient: any = null
let stripeClient: Stripe | null = null
let openaiClient: OpenAI | null = null

export function getRequiredServerEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} environment variable`)
  }
  return value
}

export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      getRequiredServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
      getRequiredServerEnv('SUPABASE_SERVICE_KEY')
    )
  }
  return supabaseAdminClient as any
}

export function getStripeServerClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getRequiredServerEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    })
  }
  return stripeClient
}

export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: getRequiredServerEnv('OPENAI_API_KEY'),
    })
  }
  return openaiClient
}
