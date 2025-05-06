// src/components/AIStatusDisplay.tsx
// Corrected to import logWarn.

'use client';
import React from 'react';
import { useAIStore, PendingAIAction } from '@/stores/useAIStore';
import { CardData } from '@/data/types'; 
import { Brain, Check, X, Send, ArrowLeftRight, AlertCircle, ShuffleIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logWarn } from '@/utils/logger'; // Added import

const getPendingActionIcon = (actionType: PendingAIAction['type'] | undefined) => {
    switch (actionType) {
        case 'propose': return <Send className="h-5 w-5 text-blue-400" />;
        case 'counter': return <ArrowLeftRight className="h-5 w-5 text-purple-400" />;
        case 'accept': 
        case 'accept_counter': return <Check className="h-5 w-5 text-emerald-400" />;
        case 'pass': return <X className="h-5 w-5 text-amber-400" />;
        case 'reject_counter': return <ShuffleIcon className="h-5 w-5 text-red-400" />;
        default: return <AlertCircle className="h-5 w-5 text-slate-400" />;
    }
};

const getPendingActionText = (action: PendingAIAction | null): string => {
    if (!action) return "AI is deciding...";

    switch (action.type) {
        case 'propose':
            return `AI intends to propose: ${action.cardsToPropose && action.cardsToPropose.length > 0 
                ? action.cardsToPropose.map((c: CardData) => c.name).join(', ') 
                : 'card(s)'}`;
        case 'counter':
            return `AI intends to counter with: ${action.cardsToCounter && action.cardsToCounter.length > 0 
                ? action.cardsToCounter.map((c: CardData) => c.name).join(', ') 
                : 'card(s)'}`;
        case 'accept':
            return `AI intends to accept: ${action.card?.name ?? 'proposal'}`;
        case 'accept_counter':
            return `AI intends to accept counter: ${action.card?.name ?? 'proposal'}`;
        case 'reject_counter':
            return `AI intends to reject counter-offer (${action.card?.name ?? 'unknown card'})`;
        case 'pass':
            return `AI intends to pass${action.reason ? ` (${action.reason})` : ''}`;
        default:
            const _exhaustiveCheck: never = action; 
            logWarn(`[AIStatusDisplay] Unhandled pending action type: ${(_exhaustiveCheck as any)?.type}`);
            return 'AI intends to perform an action';
    }
};

const AIStatusDisplay: React.FC = () => {
    const isAIThinking = useAIStore(state => state.isAIThinking);
    const pendingAIAction = useAIStore(state => state.pendingAIAction);
    const strategyName = useAIStore(state => state.strategy.name);

    let icon: React.ReactNode = <Brain className="h-5 w-5 text-purple-400" />;
    let textContent: React.ReactNode = (
        <div>
            <p className="text-slate-200 text-sm font-medium">AI is thinking...</p>
            <p className="text-xs text-slate-400">Strategy: {strategyName}</p>
        </div>
    );
    let showDisplay = isAIThinking;

    if (pendingAIAction) {
        icon = getPendingActionIcon(pendingAIAction.type);
        textContent = (
            <div>
                <p className="text-slate-200 text-sm font-medium">
                    {getPendingActionText(pendingAIAction)}
                </p>
                {pendingAIAction.reason && (
                    <p className="text-xs text-slate-400 italic">[{pendingAIAction.reason}]</p>
                )}
            </div>
        );
        showDisplay = true; 
    } else if (!isAIThinking) {
        showDisplay = false; 
    }

    return (
        <AnimatePresence>
            {showDisplay && (
                <motion.div
                    key="ai-status-display"
                    className="fixed bottom-4 right-4 lg:bottom-auto lg:top-4 lg:right-4 p-3 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl max-w-xs sm:max-w-sm z-50 pointer-events-none"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">{icon}</div>
                        <div className="flex-grow min-w-0">{textContent}</div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default React.memo(AIStatusDisplay);