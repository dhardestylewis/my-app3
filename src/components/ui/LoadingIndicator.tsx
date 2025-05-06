// src/components/ui/LoadingIndicator.tsx (Basic Placeholder)
"use client";
import React from 'react';
import { Loader2 } from 'lucide-react'; // Assuming lucide-react is installed

const LoadingIndicator: React.FC<{ className?: string, size?: number }> = ({ className, size = 8 }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <Loader2 className={`h-${size} w-${size} animate-spin text-sky-500`} /> {/* Use primary color */}
  </div>
);
export default LoadingIndicator;