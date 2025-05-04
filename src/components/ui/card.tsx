"use client";
import { motion } from "framer-motion";
import Image from 'next/image';
import CardImage from "@/components/CardImage";
import { cn } from "@/lib/utils";
import { CardData } from "@/data/types";
import * as LucideIcons from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Helper to get Lucide icon component by name string
const DynamicIcon = ({ name, ...props }: { name?: string } & LucideIcons.LucideProps) => {
  // Handle potential mapping if names don't match exactly
  const iconName = name === 'Home2' ? 'Home' : name; // Example mapping
  const IconComponent = iconName ? (LucideIcons as any)[iconName] : null;
  if (!IconComponent) {
    return <LucideIcons.HelpCircle {...props} />; // Default fallback icon
  }
  return <IconComponent {...props} />;
};

interface CardProps {
  card: CardData;
  isSelected?: boolean;
  isPlayable?: boolean;
  isPlayed?: boolean;
  onCardClick?: (id: string) => void;
  isDraggable?: boolean; // Control draggability
  selectableOnly?: boolean; // NEW: When true, card is clickable but not draggable
}

export default function Card({ 
  card, 
  isSelected = false, 
  isPlayable = true, 
  isPlayed = false, 
  onCardClick,
  isDraggable = true, // Default to true
  selectableOnly = false // NEW: Default to false
}: CardProps) {
  // Only set up draggable if the card is playable, not played, and dragging is enabled
  // Update the shouldBeDraggable logic:
  // Only set up draggable if the card is playable, not played, dragging is enabled, and not in selectableOnly mode
  const shouldBeDraggable = isDraggable && isPlayable && !isPlayed && !selectableOnly;

  // Set up draggable functionality from dnd-kit
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !shouldBeDraggable
  });
  
  // Handle click events only if the card is playable and not played
  // Update the handleClick function to always call onCardClick when in selectableOnly mode:
  const handleClick = () => {
    if (onCardClick && ((!isPlayed && isPlayable) || selectableOnly)) {
      onCardClick(card.id);
    }
  };
  
  // Determine visual cues based on state
  const ringColor = isSelected ? "ring-emerald-500" : isPlayed ? "ring-blue-900/30" : isPlayable ? "ring-white/20" : "ring-red-700/50";
  const opacity = !isPlayed && !isPlayable ? "opacity-60" : isDragging ? "opacity-80" : "opacity-100";
  const cursor = !isPlayed && isPlayable ? "cursor-pointer" : "cursor-default";
  const bgColor = isPlayed ? "bg-slate-200/70" : "bg-gradient-to-br from-white via-slate-50 to-slate-100";

  // Determine score display text and color based on rescaled score
  let scoreText = "";
  let scoreColor = "text-slate-600";
  const netScore = card.netScoreImpact ?? 0; // Default to 0 if undefined

  if (netScore > 0) {
      scoreText = `+${netScore} Dev`; // Positive -> Developer
      scoreColor = "text-amber-700 font-semibold";
  } else if (netScore < 0) {
      scoreText = `${netScore} Comm`; // Negative -> Community
      scoreColor = "text-lime-700 font-semibold";
  } else { // Zero score
      scoreText = `±0 Balance`;
      scoreColor = "text-slate-500";
  }

  // Apply transform for dragging
  const dragStyles = shouldBeDraggable ? {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? 'none' : undefined,
    zIndex: isDragging ? 999 : undefined,
  } : {};

  return (
    <motion.div
      ref={shouldBeDraggable ? setNodeRef : undefined}
      style={dragStyles}
      layout
      className={cn(
        "relative w-36 h-56 md:w-40 md:h-60 rounded-lg overflow-hidden transition-all duration-200 shadow-md hover:shadow-lg",
        bgColor,
        `ring-2 ${ringColor} ring-opacity-80`,
        opacity,
        cursor,
        isDragging ? "scale-105 shadow-xl" : "",
        isSelected ? "ring-4 shadow-emerald-500/30 scale-105 z-10" : (isPlayable && !isPlayed ? "hover:scale-105" : "")
      )}
      whileTap={isPlayable && !isPlayed && !isDragging ? { scale: 0.97 } : {}}
      onClick={handleClick}
      title={card.displayInfo?.summary || card.name} // Tooltip for summary
      {...(shouldBeDraggable ? attributes : {})}
      {...(shouldBeDraggable ? listeners : {})}
    >
        {/* Simplified Content Area */}
        <div className="p-2 flex flex-col h-full text-slate-800">
             {/* Top Row: Icon + Name */}
             <div className="flex items-center gap-1.5 mb-1 flex-shrink-0">
                 <DynamicIcon name={card.displayInfo?.icon ?? 'HelpCircle'} size={16} className="text-slate-600 flex-shrink-0" />
                 <h3 className="font-semibold text-xs leading-tight truncate flex-grow" title={card.name}>{card.name}</h3>
             </div>

             {/* Image Area */}
             <div className="relative w-full h-16 md:h-20 bg-slate-200 rounded overflow-hidden my-1 shadow-inner flex-shrink-0">
              <CardImage
                src={card.image || '/cards/placeholder.png'}
                alt={card.name}
                objectFit="cover"
                onError={(e) => (e.currentTarget.src = '/cards/placeholder.png')}
              />
             </div>

             {/* Middle Row: Category + Cost/SF */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 flex-shrink-0">
                  <span className="bg-slate-200 px-1 rounded text-slate-600">{card.category}</span>
                  <span className="font-medium">{card.displayInfo?.cost || (card.baseSqft ? `~${(card.baseSqft / 1000).toFixed(0)}k SF` : '')}</span>
              </div>

             {/* Bottom Row: Score + Summary (Ensure it fits) */}
             <div className="mt-auto border-t border-slate-300/70 pt-1 space-y-0.5 text-center flex-shrink-0">
                  <p className={`font-bold text-sm ${scoreColor}`}>{scoreText}</p>
                  <p className="text-[9px] text-slate-600 leading-snug h-6 overflow-hidden px-1">
                       {card.displayInfo?.summary || "-"}
                  </p>
             </div>
        </div>

        {/* Overlays - Simplified */}
        {isSelected && (
          <motion.div 
            layoutId="selectedIndicator" 
            className="absolute inset-0 rounded-lg border-2 border-emerald-400 pointer-events-none" 
          />
        )}
        {!isPlayable && !isPlayed && (
          <div className="absolute inset-0 bg-red-900/10 rounded-lg pointer-events-none" />
        )}
        {isDragging && (
          <div className="absolute inset-0 bg-emerald-500/20 rounded-lg pointer-events-none" />
        )}
    </motion.div>
  );
}