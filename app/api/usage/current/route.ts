import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
// CORRECTION : Suppression de 'calculateMonthlyBill' qui n'est pas utilisée.
import { getCurrentMonthUsage } from '@/lib/usage-tracking' 

export async function GET() {
  const supabase = await getSupabaseServerClient()
  
  // 1. Authentification
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Appel de la fonction de suivi d'usage
    const usage = await getCurrentMonthUsage(user.id)

    if (!usage) {
      return NextResponse.json({ error: 'Usage data not found' }, { status: 404 })
    }

    // 3. Retourner les métriques d'usage
    return NextResponse.json(usage)
    
  } catch (error) {
    console.error('API Error fetching current usage:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}