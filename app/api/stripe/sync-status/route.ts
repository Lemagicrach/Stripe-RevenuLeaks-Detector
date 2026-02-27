// /app/api/stripe/sync-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 🛑 SIMULATIONS POUR CONTOURNER LES ERREURS 2307 (À CORRIGER CHEZ VOUS)
const auth = async () => ({ user: { id: 'test-user-123' } }); 
const getSyncStatus = async (userId: string, accountId: string) => {
    // Ceci est un mock. En production, ceci irait chercher dans la base de données.
    // Retourne un statut de base
    return { 
        stage: 'IDLE', 
        message: 'Ready to start.', 
        progress: 0 
    };
};
// FIN DES SIMULATIONS

export async function GET(request: NextRequest) {
    const session = await auth();

    if (!session || !session.user?.id) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const stripeAccountId = searchParams.get('accountId');

    if (!stripeAccountId) {
        return NextResponse.json({ 
            stage: 'IDLE', 
            message: 'Stripe Account ID is required.', 
            progress: 0 
        }, { status: 400 });
    }

    try {
        const currentStatus = await getSyncStatus(session.user.id, stripeAccountId);

        if (!currentStatus) {
            return NextResponse.json({
                stage: 'IDLE', 
                message: 'No previous synchronization found.',
                progress: 0,
            }, { status: 200 });
        }
        
        return NextResponse.json({
            stage: currentStatus.stage,
            message: currentStatus.message,
            progress: currentStatus.progress,
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching sync status:', error);
        
        return NextResponse.json({
            stage: 'FAILED', 
            message: 'Internal server error while retrieving sync status.',
            progress: 0,
        }, { status: 500 });
    }
}