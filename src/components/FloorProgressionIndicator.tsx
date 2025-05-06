// src/components/FloorProgressionIndicator.tsx (Basic Placeholder)
"use client";
import React from 'react';
import { Layers } from 'lucide-react'; // Using Layers icon

export interface FloorProgressionIndicatorProps {
  currentFloor: number;
  maxFloors: number;
}

const FloorProgressionIndicator: React.FC<FloorProgressionIndicatorProps> = ({ currentFloor, maxFloors }) => {
  const progressPercentage = maxFloors > 0 ? (Math.min(currentFloor, maxFloors) / maxFloors) * 100 : 0;
  const displayCurrentFloor = Math.min(currentFloor, maxFloors); // Don't show current floor > max

  return (
    <div className="my-1">
      <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300 mb-1">
        <span className="font-medium flex items-center">
            <Layers size={14} className="mr-1.5 text-slate-400"/>Floor Progress
        </span>
        <span>{displayCurrentFloor} / {maxFloors}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden border border-slate-600">
        <div
          className="bg-sky-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};
export default FloorProgressionIndicator;