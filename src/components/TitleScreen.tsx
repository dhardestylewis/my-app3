// src/components/TitleScreen.tsx
// Added onStartGame prop.

'use client';
import React, { useState } from "react";
import { useGameFlowStore } from "@/stores/useGameFlowStore";
import { PlayerRole } from "@/data/types"; 
import { Button } from "@/components/ui/button"; // Assuming path is correct
import { Building, Users, Scale, Layers, ArrowRightLeft, RefreshCcw } from 'lucide-react';
import { RECALL_MAX_FLOOR } from "@/data/constants";

// Define Props for TitleScreen
export interface TitleScreenProps { // Exporting if App.tsx needs to import it (optional)
  onStartGame: (selectedRole: PlayerRole) => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
    const [selectedRole, setSelectedRole] = useState<PlayerRole>(PlayerRole.Community);

    const handleStart = () => {
        onStartGame(selectedRole); // Call the prop
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white p-6 sm:p-8">
            <Scale size={64} className="mb-4 text-emerald-400 drop-shadow-lg" />
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Urban Balance
            </h1>
            <h2 className="text-xl text-slate-300 mb-6 text-center">Floor-by-Floor Negotiation</h2>
            <p className="text-slate-300 mb-8 text-lg text-center max-w-lg">
                Build a balanced urban development through strategic negotiation. Choose your starting role below.
            </p>
            <div className="bg-slate-800/60 p-6 rounded-lg border border-slate-700 mb-8 w-full max-w-xl shadow-md">
                <h3 className="font-semibold text-lg mb-4 text-center text-emerald-400">Game Features</h3>
                <ul className="space-y-2 text-slate-300 text-sm md:text-base">
                    <li className="flex items-start">
                        <Layers className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Negotiate card placement floor-by-floor via proposals & counters.</span>
                    </li>
                    <li className="flex items-start">
                        <ArrowRightLeft className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Lead player alternates, demanding adaptive strategy.</span>
                    </li>
                    <li className="flex items-start">
                        <RefreshCcw className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Use limited recall tokens to strategically reopen past floors (below floor {RECALL_MAX_FLOOR}).</span>
                    </li>
                     <li className="flex items-start">
                        <Scale className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>Achieve balance! Keep the final score close to zero to win.</span>
                    </li>
                </ul>
            </div>
            <div className="space-y-4 mb-8 w-full max-w-sm">
                <p className="text-center font-medium text-slate-300">Choose Your Role:</p>
                <div className="flex gap-4">
                    <Button
                        variant={selectedRole === PlayerRole.Community ? "default" : "outline"}
                        onClick={() => setSelectedRole(PlayerRole.Community)}
                        className={`flex-1 transition-all duration-150 ${selectedRole === PlayerRole.Community ? 'bg-lime-600 hover:bg-lime-500 text-white scale-105 ring-2 ring-lime-400' : 'border-lime-600/50 text-lime-500 hover:text-lime-400 hover:bg-lime-900/30'}`}
                    >
                        <Users className="mr-2 h-5 w-5" /> Community
                    </Button>
                    <Button
                        variant={selectedRole === PlayerRole.Developer ? "default" : "outline"}
                        onClick={() => setSelectedRole(PlayerRole.Developer)}
                        className={`flex-1 transition-all duration-150 ${selectedRole === PlayerRole.Developer ? 'bg-amber-600 hover:bg-amber-500 text-white scale-105 ring-2 ring-amber-400' : 'border-amber-600/50 text-amber-500 hover:text-amber-400 hover:bg-amber-900/30'}`}
                    >
                        <Building className="mr-2 h-5 w-5" /> Developer
                    </Button>
                </div>
                <Button
                    size="lg"
                    onClick={handleStart} // Use local handler
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-lg font-semibold tracking-wide py-3 shadow-lg hover:shadow-emerald-500/30 transition-shadow"
                >
                    Start Game as {selectedRole === PlayerRole.Community ? 'Community' : 'Developer'}
                </Button>
            </div>
            <p className="text-slate-500 text-sm text-center max-w-lg mt-4">
                You will negotiate each floor with an AI opponent representing the other role. Good luck achieving balance!
            </p>
        </div>
    );
}

export default TitleScreen;