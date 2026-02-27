// app/api/benchmarks/compare/route.ts
import { NextRequest, NextResponse } from 'next/server'
// Pas besoin d'importer createClient ici, car il est dans PeerBenchmarkingEngine

import { PeerBenchmarkingEngine } from '@/lib/peer-benchmarking'

export async function GET(request: NextRequest) {
  try {
    // Le client Supabase est géré à l'intérieur de l'Engine

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Create benchmarking engine (sans passer le client Supabase car il est déjà géré en interne)
    const benchmarkEngine = new PeerBenchmarkingEngine(connectionId)

    // Get benchmark comparison
    const insights = await benchmarkEngine.getBenchmarkComparison()

    // Le frontend PeerBenchmarkingDashboard gère l'affichage Opt-In si peerGroupSize est 0.
    return NextResponse.json({
      success: true,
      insights,
    })
  } catch (error: any) {
    console.error('Error getting benchmark comparison:', error)
    
    // Assurer que le frontend peut gérer l'erreur, si l'Engine lance une exception.
    return NextResponse.json(
      { 
          success: false,
          error: 'Failed to get benchmark comparison', 
          details: error.message 
      },
      { status: 500 }
    )
  }
}