import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { handleApiError } from '@/lib/server-error'
import { getSupabaseAdminClient } from '@/lib/server-clients'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const {
      predictionId,
      interventionType,
      sendEmail,
      customMessage,
      offerDetails,
    } = await request.json()

    if (!predictionId) {
      return NextResponse.json({ error: 'Prediction ID required' }, { status: 400 })
    }

    // Get prediction details - select only necessary columns to avoid sensitive data
    const { data: prediction, error: predError } = await supabase
      .from('churn_predictions')
      .select(
        'id, stripe_connection_id, customer_id, generated_email_subject, generated_email_body, recommended_actions'
      )
      .eq('id', predictionId)
      .single()

    if (predError || !prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 })
    }

    // Get customer email from Stripe
    const { data: connection } = await supabase
      .from('stripe_connections')
      .select('access_token')
      .eq('id', prediction.stripe_connection_id)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Send email if requested
    let emailSent = false
    if (sendEmail) {
      try {
        const emailSubject = customMessage?.subject || prediction.generated_email_subject
        const emailBody = customMessage?.body || prediction.generated_email_body

        // In production, you'd fetch the actual customer email from Stripe
        // For now, we'll log it
        console.log('Would send email:', {
          to: prediction.customer_id,
          subject: emailSubject,
          body: emailBody,
        })

        // Uncomment when ready to send real emails:
        // await sgMail.send({
        //   to: customerEmail,
        //   from: process.env.SENDGRID_FROM_EMAIL!,
        //   subject: emailSubject,
        //   text: emailBody,
        // })

        emailSent = true
      } catch (error) {
        console.error('Error sending email:', error)
      }
    }

    // Record intervention and return only necessary fields
    const { data: intervention, error: intError } = await supabase
      .from('churn_interventions')
      .insert({
        churn_prediction_id: predictionId,
        stripe_connection_id: prediction.stripe_connection_id,
        customer_id: prediction.customer_id,
        intervention_type: interventionType,
        intervention_description:
          customMessage?.description || prediction.recommended_actions[0]?.description,
        email_sent: emailSent,
        offer_type: offerDetails?.type,
        offer_value: offerDetails?.value,
      })
      .select(
        'id, churn_prediction_id, stripe_connection_id, customer_id, intervention_type, intervention_description, email_sent, offer_type, offer_value, created_at'
      )
      .single()

    if (intError) {
      return NextResponse.json({ error: intError.message }, { status: 500 })
    }

    // Update prediction status
    await supabase
      .from('churn_predictions')
      .update({
        status: 'actioned',
        actioned_at: new Date().toISOString(),
      })
      .eq('id', predictionId)

    return NextResponse.json({
      success: true,
      intervention,
      emailSent,
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'CHURN_INTERVENE_POST')
    return NextResponse.json(errRes, { status: 500 })
  }
}

// Get intervention history
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')
    const customerId = searchParams.get('customerId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Select only necessary fields for intervention history
    let query = supabase
      .from('churn_interventions')
      .select(
        'id, churn_prediction_id, stripe_connection_id, customer_id, intervention_type, intervention_description, email_sent, offer_type, offer_value, created_at, updated_at'
      )
      .eq('stripe_connection_id', connectionId)
      .order('created_at', { ascending: false })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data: interventions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      interventions,
    })
  } catch (error: any) {
    // Unexpected error: return standardized error with unique code
    const errRes = handleApiError(error, 'CHURN_INTERVENE_GET')
    return NextResponse.json(errRes, { status: 500 })
  }
}
