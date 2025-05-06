// src/components/ui/Card.tsx
// F.3: Refactored to accept and display a proposal/counter count.

"use client";
import React, { useMemo } from 'react';
import { motion } from "framer-motion";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { CardData } from "@/data/types";
import * as LucideIcons from 'lucide-react';
import { MAX_STORIES } from '@/data/constants';
import { DEFAULT_CARD_IMAGE_PATH } from '@/data/deckData';

// Dynamic icon lookup
const DynamicIcon = ({ name, ...props }: { name?: string } & LucideIcons.LucideProps) => {
  const iconName = name === 'Home2' ? 'Home' : name; 
  const IconComponent = iconName && iconName in LucideIcons ? (LucideIcons as any)[iconName] : LucideIcons.HelpCircle;
  return <IconComponent {...props} />;
};

interface CardProps {
  card: CardData;
  isSelected?: boolean;
  isPlayable?: boolean;
  isPlayed?: boolean;        // True if card is shown in a proposal slot, not in hand
  floorRestricted?: boolean;
  displayCount?: number;     // F.3: The count of this card being proposed/countered from hand
}

export default function CardComponent({
  card,
  isSelected = false,
  isPlayable = true,
  isPlayed = false,
  floorRestricted = false,
  displayCount // F.3: New prop
}: CardProps) {
  
  const {
    instanceId, // instanceId of the stack in hand, or of the played card
    name = "Unnamed Card",
    image = DEFAULT_CARD_IMAGE_PATH, 
    category = "N/A",
    netScoreImpact,
    requiresFloor = [],
    displayInfo = {}
  } = card || {};

  const { 
    summary = '-', 
    icon = 'HelpCircle'
  } = displayInfo;

  const floorRestrictionText = useMemo(() => { /* ... (as before) ... */ 
    if (!requiresFloor || requiresFloor.length === 0) return 'Any Floor';
    return requiresFloor.map(f => {
      if (typeof f === 'string') {
        if (f.toLowerCase() === 'ground') return 'Ground';
        if (f.toLowerCase() === 'roof') return `Roof (${MAX_STORIES})`;
        return f.charAt(0).toUpperCase() + f.slice(1);
      }
      return `F${f}`;
    }).join(' / ');
  }, [requiresFloor]);

  const netScore = netScoreImpact ?? 0;
  let scoreText = '±0 Bal';
  let scoreColor = 'text-slate-600';
  if (netScore > 0) { /* ... (as before) ... */ 
    scoreText = `+${netScore} Dev`;
    scoreColor = 'text-amber-700 font-semibold';
  } else if (netScore < 0) { /* ... (as before) ... */ 
    scoreText = `${netScore} Comm`;
    scoreColor = 'text-lime-700 font-semibold';
  }


  const ringColor = isSelected
    ? 'ring-emerald-500'
    : isPlayed
      ? 'ring-blue-900/30'
      : floorRestricted
        ? 'ring-red-700/50'
        : isPlayable
          ? 'ring-slate-300/30'
          : 'ring-slate-500/30';

  const visualOpacity = (!isPlayed && (floorRestricted || !isPlayable)) ? 'opacity-70' : 'opacity-100';
  
  const bgColor = isPlayed
    ? 'bg-slate-200/70'
    : floorRestricted
      ? 'bg-gradient-to-br from-white/90 via-red-50/90 to-red-100/90'
      : 'bg-gradient-to-br from-white via-slate-50 to-slate-100';

  return (
    <motion.div
      layout
      className={cn(
        "relative w-36 h-56 md:w-40 md:h-60 rounded-lg overflow-hidden transition-all duration-200 shadow-md",
        bgColor,
        `ring-2 ${ringColor}`,
        visualOpacity,
        isSelected && !isPlayed ? 'ring-4 shadow-sky-500/40 scale-105 z-10' : '' // Updated selection color to sky blue
      )}
      title={summary || name}
    >
      {/* Main card content container */}
      <div className="p-2 flex flex-col h-full text-slate-800 pointer-events-none">
        {/* ... (icon, name, image, category, floorRestrictionText, score text as before) ... */}
        <div className="flex items-center gap-1.5 mb-1 flex-shrink-0">
          <DynamicIcon name={icon} size={16} className="text-slate-600 flex-shrink-0" />
          <h3 className="font-semibold text-xs leading-tight truncate flex-grow" title={name}>{name}</h3>
        </div>
        <div className="relative w-full h-16 md:h-20 bg-slate-200 rounded overflow-hidden my-1 shadow-inner flex-shrink-0">
          <Image
            src={image}
            alt={name || 'Card image'}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 144px, 160px"
            priority={false}
            onError={e => { (e.target as HTMLImageElement).src = DEFAULT_CARD_IMAGE_PATH; }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 flex-shrink-0">
          <span className="bg-slate-200 px-1 rounded text-slate-600">{category}</span>
          {requiresFloor && requiresFloor.length > 0 && (
            <span className={cn('px-1 rounded', floorRestricted ? 'bg-red-100 text-red-700 font-semibold' : 'bg-slate-200 text-slate-600')}>
              {floorRestrictionText}
            </span>
          )}
        </div>
        <div className="mt-auto border-t border-slate-300/70 pt-1 space-y-0.5 text-center flex-shrink-0">
          <p className={`font-bold text-sm ${scoreColor}`}>{scoreText}</p>
          <p className="text-[9px] text-slate-600 leading-snug h-6 overflow-hidden px-1">
            {summary}
          </p>
        </div>
      </div>

      {/* F.3: Display Count Badge - only if not 'isPlayed' (i.e., for hand cards) and count > 0 */}
      {displayCount && displayCount > 0 && !isPlayed && (
        <motion.div 
            layoutId={`displayCountBadge-${instanceId}`} // Animate if needed
            className="absolute top-0.5 right-0.5 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800"
            aria-label={`Proposing ${displayCount} of this card`}
        >
          {displayCount}
        </motion.div>
      )}

      {/* Visual indicator for general selection (e.g. ring), if needed beyond the count badge */}
      {isSelected && !isPlayed && instanceId && ( 
        <motion.div
          layoutId={`selectedCardHighlight-${instanceId}`} 
          className="absolute inset-0 rounded-lg border-2 border-sky-400 pointer-events-none" // Changed to sky blue
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
      {floorRestricted && !isPlayed && (
         <div className="absolute inset-0 bg-red-500/5 rounded-lg pointer-events-none" />
      )}
    </motion.div>
  );
}