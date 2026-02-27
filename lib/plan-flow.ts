export type PaidPlanId = 'professional' | 'business'

const PAID_PLAN_LABELS: Record<PaidPlanId, string> = {
  professional: 'Professional',
  business: 'Business',
}

export function sanitizePlanId(input: string | null | undefined): PaidPlanId | null {
  if (!input) return null

  const normalized = input.trim().toLowerCase()
  if (normalized === 'pro') return 'professional'
  if (normalized === 'professional' || normalized === 'business') {
    return normalized
  }

  return null
}

export function getPaidPlanLabel(planId: PaidPlanId): string {
  return PAID_PLAN_LABELS[planId]
}

export function buildConnectUrl(planId?: string | null) {
  const paidPlan = sanitizePlanId(planId)
  if (!paidPlan) return '/connect'
  return `/connect?plan=${encodeURIComponent(paidPlan)}`
}

type ExtraParams =
  | URLSearchParams
  | Record<string, string | number | boolean | null | undefined>

export function buildPostConnectLeaksUrl(planId?: string | null, extraParams?: ExtraParams) {
  const params = new URLSearchParams()
  const paidPlan = sanitizePlanId(planId)

  if (paidPlan) {
    params.set('intent_plan', paidPlan)
  }

  if (extraParams instanceof URLSearchParams) {
    extraParams.forEach((value, key) => {
      params.set(key, value)
    })
  } else if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined) return
      params.set(key, String(value))
    })
  }

  const query = params.toString()
  return query ? `/dashboard/leaks?${query}` : '/dashboard/leaks'
}
