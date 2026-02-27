// components/ui/MetricTooltip.tsx
import React, { ReactNode } from 'react';
// Vous aurez besoin d'importer vos composants de Tooltip.
// Si vous utilisez ShadCN/Radix:
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; 
import { InfoIcon } from 'lucide-react'; // Icône simple d'information

interface MetricTooltipProps {
  label: string;
  definition: string;
  // Children est l'élément qui déclenche l'infobulle (par exemple, le texte de la métrique ou une icône)
  children: ReactNode; 
}

/**
 * Composant de Tooltip pour expliquer les métriques complexes.
 * Il enveloppe l'élément déclencheur et affiche la définition.
 */
export const MetricTooltip: React.FC<MetricTooltipProps> = ({ 
  label, 
  definition, 
  children 
}) => {
  return (
    // ⚠️ IMPORTANT : TooltipProvider est généralement placé à la racine de votre application
    // Assurez-vous qu'il est bien configuré (voir l'étape 2)
    <TooltipProvider delayDuration={200}> 
      <Tooltip>
        <TooltipTrigger asChild>
          {/* L'icône ou le texte qui déclenche le tooltip, avec le style pour indiquer l'interactivité */}
          <span className="flex items-center gap-1 cursor-help text-gray-400 hover:text-gray-600 transition duration-150">
            {children}
            <InfoIcon className="w-3.5 h-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-gray-800 text-white p-3 rounded-md shadow-lg text-sm z-[9999]">
          <h4 className="font-bold mb-1 border-b border-gray-600 pb-1">{label}</h4>
          <p>{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};