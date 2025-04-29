"use client";
import { useState } from "react";
// Corrected: Import from the specific stores used previously
import { useGameFlowStore } from "@/stores/useGameFlowStore";
import { PlayerRole } from "@/stores/usePlayersStore"; // Import PlayerRole enum
import { Button } from "@/components/ui/button";
import { Building, Users, Scale, Layers, ArrowRightLeft, RefreshCcw } from 'lucide-react';

export default function TitleScreen() {
    // Corrected: Use the specific store hook
    const startGame = useGameFlowStore((state) => state.startGame);
    // State management for role selection remains the same
    const [selectedRole, setSelectedRole] = useState<PlayerRole>(PlayerRole.Community); // Use enum type

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white p-8">
            <Scale size={64} className="mb-4 text-emerald-400" />
            <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Urban Balance
            </h1>
            <h2 className="text-xl text-slate-300 mb-6">Floor-by-Floor Negotiation</h2>

            <p className="text-slate-300 mb-6 text-lg text-center max-w-md">
                Build a balanced urban development through strategic negotiation on each floor.
            </p>

            {/* Features Box - No changes needed */}
            <div className="bg-slate-800/70 p-6 rounded-lg border border-slate-700 mb-8 max-w-lg">
                 <h3 className="font-semibold text-lg mb-3 text-center text-emerald-400">Game Features</h3>
                 <ul className="space-y-2 text-slate-300"> {/* Added text color */}
                     <li className="flex items-start">
                         <Layers className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                         <span>Each floor is a mini-negotiation with proposals and counter-proposals</span>
                     </li>
                     <li className="flex items-start">
                         <ArrowRightLeft className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                         <span>Lead player alternates in 5-floor blocks to balance advantage</span>
                     </li>
                     <li className="flex items-start">
                         <RefreshCcw className="mr-2 h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                         <span>Use recall tokens to reopen previous floors (until floor 12)</span>
                     </li>
                 </ul>
            </div>

            {/* Role Selection & Start Button - Use PlayerRole enum */}
            <div className="space-y-4 mb-8 w-full max-w-sm">
                <div className="flex gap-4 mb-2">
                    <Button
                        variant={selectedRole === PlayerRole.Community ? "default" : "outline"}
                        onClick={() => setSelectedRole(PlayerRole.Community)}
                        className={`flex-1 ${selectedRole === PlayerRole.Community ? 'bg-lime-600 hover:bg-lime-700 text-white' : 'border-lime-600/50 text-lime-500 hover:text-lime-400 hover:bg-lime-900/20'}`}
                    >
                        <Users className="mr-2 h-5 w-5" /> Community
                    </Button>
                    <Button
                        variant={selectedRole === PlayerRole.Developer ? "default" : "outline"}
                        onClick={() => setSelectedRole(PlayerRole.Developer)}
                         className={`flex-1 ${selectedRole === PlayerRole.Developer ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'border-amber-600/50 text-amber-500 hover:text-amber-400 hover:bg-amber-900/20'}`}
                    >
                        <Building className="mr-2 h-5 w-5" /> Developer
                    </Button>
                </div>
                <Button
                    size="lg"
                    // Pass the selected PlayerRole enum member
                    onClick={() => startGame(selectedRole)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                    Start Game
                </Button>
            </div>

            <p className="text-slate-500 text-sm text-center max-w-md">
                You will negotiate each floor with an AI opponent. Your goal is to keep the final project balanced between community and developer interests.
            </p>
        </div>
    );
}