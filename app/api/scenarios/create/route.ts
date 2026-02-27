import { NextRequest, NextResponse } from 'next/server'
import { ScenarioPlannerEngine } from '@/lib/scenario-planner'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { reportScenarioUsageForUser } from '@/lib/stripeUsage'
import { handleApiError } from '@/lib/server-error'

// POST /api/scenarios/create - Create a new scenario
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      connectionId,
      name,
      scenarioType,
      parameters,
      description,
    } = await request.json()

    if (!connectionId || !name || !scenarioType || !parameters) {
      return NextResponse.json(
        { error: 'Connection ID, name, scenario type, and parameters required' },
        { status: 400 }
      )
    }

    // Pre-check: enforce scenario limit based on subscription tier
    const { data: canCreate, error: limitError } = await supabase.rpc(
      'check_scenario_limit',
      { p_user_id: user.id }
    )

    if (limitError) {
      console.error('check_scenario_limit error:', limitError)
      // Use standardized error response for DB errors
      const errRes = handleApiError(limitError, 'SCENARIO_LIMIT')
      return NextResponse.json(errRes, { status: 500 })
    }

    if (!canCreate) {
      return NextResponse.json(
        {
          error:
            'Scenario limit reached for your plan. Please upgrade to create more scenarios.',
        },
        { status: 403 }
      )
    }

    // Create scenario planner
    const planner = new ScenarioPlannerEngine(connectionId)

    // Create and calculate scenario
    const result = await planner.createScenario(
      name,
      scenarioType,
      parameters,
      description
    )

    // Update internal usage in Postgres
    await supabase.rpc('increment_scenario_usage', { p_user_id: user.id })

    // Report usage to Stripe (do not block main flow on failure)
    try {
      await reportScenarioUsageForUser(user.id, 1)
    } catch (usageError) {
      console.error('Error reporting usage to Stripe:', usageError)
    }

    return NextResponse.json({
      success: true,
      scenario: result,
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'SCENARIO_CREATE')
    return NextResponse.json(errRes, { status: 500 })
  }
}

// GET /api/scenarios/create?connectionId=xxx - Fetch saved scenarios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID required' },
        { status: 400 }
      )
    }

    const planner = new ScenarioPlannerEngine(connectionId)
    const scenarios = await planner.getSavedScenarios()

    return NextResponse.json({
      success: true,
      scenarios,
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'SCENARIO_GET')
    return NextResponse.json(errRes, { status: 500 })
  }
}