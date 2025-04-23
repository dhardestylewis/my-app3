"use client";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "@/components/ui/button";
import { Award, Users, Building, RefreshCw, Scale, CircleHelp, Clock, ArrowLeftRight } from 'lucide-react';

export default function GameOverScreen() {
  const { 
    winnerMessage, 
    gameOverReason, 
    building, 
    resetGame, 
    telemetry
  } = useGameStore((state) => ({
     winnerMessage: state.winnerMessage,
     gameOverReason: state.gameOverReason,
     building: state.building,
     resetGame: state.resetGame,
     telemetry: state.telemetry
  }));
  
  // Determine outcome based on message
  let OutcomeIcon = Scale;
  let outcomeColor = "text-yellow-400"; // Default for balanced
  
  if (winnerMessage?.includes("FAVORS DEVELOPER")) {
      OutcomeIcon = Building;
      outcomeColor = "text-amber-400";
  } else if (winnerMessage?.includes("FAVORS COMMUNITY")) {
      OutcomeIcon = Users;
      outcomeColor = "text-lime-400";
  } else if (winnerMessage?.includes("BALANCED")) {
      OutcomeIcon = Scale;
      outcomeColor = "text-emerald-400";
  } else if (winnerMessage?.includes("Failed")) {
      OutcomeIcon = CircleHelp;
      outcomeColor = "text-red-500";
  }
  
  // Calculate average negotiation time
  const avgNegotiationTime = Object.values(telemetry.negotiationTimes).length > 0
    ? (Object.values(telemetry.negotiationTimes).reduce((a, b) => a + b, 0) / 
       Object.values(telemetry.negotiationTimes).length).toFixed(1)
    : 'N/A';
    
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white p-8">
       <OutcomeIcon size={64} className={`mb-4 ${outcomeColor}`} />
       <h1 className="text-4xl font-bold mb-3 text-center">
           {winnerMessage?.includes("Failed") ? "Project Failed" : "Building Complete"}
       </h1>
       <p className={`text-lg mb-4 text-center font-semibold ${outcomeColor}`}>
           {winnerMessage || "Outcome undecided."}
       </p>
       <p className="text-slate-400 mb-8 text-center max-w-lg">{gameOverReason}</p>
       
       {/* Game Analytics Display */}
       <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
         {/* Final Project Stats */}
         <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 text-center">
           <h3 className="text-lg font-semibold mb-2 text-slate-300">Final Project Stats</h3>
           <p>Height: {building.totalHeight} Stories</p>
           <p>Final Balance Score: <span className={`font-bold ${outcomeColor}`}>
             {building.currentNetScore > 0 ? '+' : ''}{building.currentNetScore}
           </span></p>
         </div>
         
         {/* Game Analytics */}
         <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
           <h3 className="text-lg font-semibold mb-2 text-slate-300 text-center">Negotiation Analytics</h3>
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <span className="flex items-center">
                 <Clock className="mr-2 h-4 w-4 text-blue-400" />
                 Avg. Negotiation Time:
               </span>
               <span className="font-semibold">{avgNegotiationTime}s</span>
             </div>
             <div className="flex items-center justify-between">
               <span className="flex items-center">
                 <ArrowLeftRight className="mr-2 h-4 w-4 text-purple-400" />
                 Recall Tokens Used:
               </span>
               <span>
                 <span className="text-lime-400 font-semibold mr-2">Community: {telemetry.recallsUsed.community}</span>
                 <span className="text-amber-400 font-semibold">Developer: {telemetry.recallsUsed.developer}</span>
               </span>
             </div>
           </div>
         </div>
       </div>
       
       <Button size="lg" onClick={resetGame} className="bg-emerald-600 hover:bg-emerald-700">
           <RefreshCw className="mr-2 h-5 w-5" /> Play Again
       </Button>
    </div>
  );
}