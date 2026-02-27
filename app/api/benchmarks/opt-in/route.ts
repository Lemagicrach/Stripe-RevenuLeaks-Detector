import { NextRequest, NextResponse } from 'next/server'
// Assurez-vous que le chemin d'accès à PeerBenchmarkingEngine est correct
import { PeerBenchmarkingEngine } from '@/lib/peer-benchmarking' 

/**
 * Gère l'adhésion au réseau de benchmarking (Opt-In).
 * Requiert connectionId, industryVertical, businessModel et preferences.
 */
export async function POST(request: NextRequest) {
  try {
    // Déstructure les données du corps de la requête
    const { connectionId, industryVertical, businessModel, preferences } = await request.json()

    // Validation de base des paramètres requis
    if (!connectionId || !industryVertical || !businessModel) {
      return NextResponse.json(
        { error: 'Connection ID, industry vertical, and business model required' },
        { status: 400 } // Bad Request
      )
    }

    // 1. Création du moteur de benchmarking
    const benchmarkEngine = new PeerBenchmarkingEngine(connectionId)

    // 2. Adhésion (sauvegarde des préférences)
    await benchmarkEngine.optIn({
      industryVertical,
      businessModel,
      ...preferences, // Intègre les préférences partagées (MRR, Churn, etc.)
    })

    // 3. Contribution immédiate des métriques pour charger le premier résultat
    await benchmarkEngine.contributeMetrics(new Date())

    return NextResponse.json({
      success: true,
      message: 'Successfully opted into peer benchmarking',
    })
  } catch (error: any) {
    console.error('Error opting into benchmarks:', error)
    return NextResponse.json(
      { error: 'Failed to opt into benchmarks', details: error.message },
      { status: 500 } // Internal Server Error
    )
  }
}

/**
 * Gère le retrait du réseau de benchmarking (Opt-Out).
 * Requiert connectionId en paramètre de recherche.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId') // Récupère l'ID depuis l'URL

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // 1. Création du moteur de benchmarking
    const benchmarkEngine = new PeerBenchmarkingEngine(connectionId)

    // 2. Retrait (met à jour le statut dans la base de données)
    await benchmarkEngine.optOut()

    return NextResponse.json({
      success: true,
      message: 'Successfully opted out of peer benchmarking',
    })
  } catch (error: any) {
    console.error('Error opting out of benchmarks:', error)
    return NextResponse.json(
      { error: 'Failed to opt out of benchmarks', details: error.message },
      { status: 500 }
    )
  }
}