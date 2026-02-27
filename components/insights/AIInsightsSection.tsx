'use client'

import React from 'react';
import { LockIcon, ZapIcon } from 'lucide-react';

type UserTier = 'starter' | 'professional' | 'business' | 'enterprise';

interface AIInsightsSectionProps {
  // Le niveau d'abonnement de l'utilisateur, passé depuis la page parente
  userTier: UserTier; 
  connectionId: string;
}

/**
 * Composant qui affiche soit les insights IA, soit un Paywall doux.
 */
export const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({ userTier, connectionId }) => {
  // 1. Définir le niveau d'accès requis
  const MIN_REQUIRED_TIER: UserTier = 'professional';
  
  // 2. Vérification de l'accès
  const isAuthorized = userTier === 'professional' || userTier === 'business' || userTier === 'enterprise';

  if (!isAuthorized) {
    // 3. AFFICHAGE DU PAYWALL DOUX
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg border border-yellow-200">
        <div className="flex items-center space-x-4 mb-4">
          <LockIcon className="w-8 h-8 text-yellow-500" />
          <h3 className="text-2xl font-bold text-gray-800">
            Insights IA Premium Verrouillés
          </h3>
        </div>
        <p className="text-gray-600 mb-6">
          Pour débloquer l'analyse de risque de désabonnement alimentée par l'IA et les prédictions avancées de revenus, vous devez passer au plan **{MIN_REQUIRED_TIER}** ou supérieur.
        </p>
        
        {/* CTA : Lien vers la page de tarification pour encourager la conversion */}
        <a 
          href="/pricing" 
          className="inline-flex items-center px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold shadow-md hover:bg-yellow-700 transition duration-150"
        >
          <ZapIcon className="w-5 h-5 mr-2" />
          Débloquer l'IA pour seulement 
        </a>
      </div>
    );
  }

  // 4. CONTENU PREMIUM (Chargement des Insights IA)
  // Si l'utilisateur est autorisé, vous chargez ici le contenu de l'IA (votre logique existante)
  return (
    <div className="p-4 bg-white rounded-xl shadow-lg">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <ZapIcon className="w-5 h-5 mr-2 text-indigo-500" />
        Vos Insights IA Avancés
      </h3>
      {/* ... Votre composant réel qui charge et affiche les données IA depuis /api/insights ... */}
      <p className="text-gray-600">Le contenu IA se charge ici, car l'abonnement est actif.</p>
      {/* <LoadedAIContent connectionId={connectionId} /> */}
    </div>
  );
};