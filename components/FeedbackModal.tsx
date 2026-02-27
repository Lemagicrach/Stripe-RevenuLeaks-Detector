// components/FeedbackModal.tsx
'use client';

import { useFeedback } from '@/hooks/use-feedback'; // ⬅️ IMPORT CORRIGÉ
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'; // Assurez-vous que le chemin est correct
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';

export default function FeedbackModal() {
  // ... (Le reste du code de FeedbackModal reste identique à la proposition précédente) ...
  const { isFeedbackOpen, closeFeedback } = useFeedback();
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (feedback.trim().length < 10) {
      toast.error('Veuillez fournir au moins 10 caractères pour le feedback.');
      return;
    }
    
    setIsLoading(true);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        toast.success('Merci ! Votre feedback a été soumis.');
        setFeedback('');
        closeFeedback();
    } catch (error) {
        toast.error('Échec de la soumission du feedback. Veuillez réessayer.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isFeedbackOpen} onOpenChange={closeFeedback}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Partagez Votre Feedback</DialogTitle>
          <DialogDescription>
            Aidez-nous à nous améliorer en nous disant ce que vous aimez ou ce que nous pouvons améliorer.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="J'adore le nouveau tableau de bord, mais le graphique prend trop de temps à charger..."
            value={feedback}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button 
            onClick={closeFeedback} 
            variant="outline"
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || feedback.trim().length < 10}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Soumettre le feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
