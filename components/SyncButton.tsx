// components/SyncButton.tsx
'use client'

import { useSyncStatus } from '@/hooks/useSyncStatus';
import { RefreshCw, Zap } from 'lucide-react'; 

interface SyncButtonProps {
  stripeAccountId: string;
  onSyncComplete: () => Promise<void>;
  disabled?: boolean; 
  isForced?: boolean; 
}

export default function SyncButton({ 
    stripeAccountId, 
    onSyncComplete, 
    disabled = false, 
    isForced = false 
}: SyncButtonProps) {
    
    const { status, triggerSync } = useSyncStatus(stripeAccountId);

    if (status.stage === 'COMPLETED') {
        onSyncComplete();
    }

    const isDisabled = status.isSyncing || disabled;

    const baseClass = "flex items-center justify-center gap-2 font-semibold transition-all";
    
    const styleClass = isForced
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white w-full px-6 py-3 rounded-lg text-base' 
      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm';

    const disabledClass = isDisabled ? 'opacity-50 cursor-not-allowed' : '';


    return (
        <button
            onClick={() => triggerSync(true)}
            disabled={isDisabled}
            className={`${baseClass} ${styleClass} ${disabledClass}`}
        >
            {status.isSyncing ? (
                <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing... ({status.progress}%)
                </>
            ) : (
                <>
                    {isForced ? (
                        <>
                            <Zap className="w-4 h-4" />
                            Start First Sync
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Sync Now
                        </>
                    )}
                </>
            )}
        </button>
    );
}