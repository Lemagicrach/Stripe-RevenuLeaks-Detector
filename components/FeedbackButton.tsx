// components/FeedbackButton.tsx
'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeedback } from '@/hooks/use-feedback'; // ⬅️ IMPORT CORRIGÉ
import { usePathname } from 'next/navigation';

export default function FeedbackButton() {
  const { openFeedback } = useFeedback(); 
  const pathname = usePathname();

  if (pathname === '/') {
    return null;
  }

  return (
    <Button
      onClick={openFeedback} 
      variant="default" 
      className="fixed bottom-4 right-4 z-50 rounded-full p-3 shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
      aria-label="Give feedback"
    >
      <MessageSquare className="w-5 h-5" />
    </Button>
  );
}
