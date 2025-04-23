"use client";
import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import TitleScreen from './title-screen';
import GameScreen from './game-screen';
import GameOverScreen from './game-over-screen';

// Main component for the card game
const CardGame = () => {
  const { 
    gameState,
    resetGame,
  } = useGameStore();
  
  // Render different screens based on game state
  const renderGameScreen = () => {
    switch (gameState) {
      case 'title':
        return <TitleScreen />;
      case 'playing':
        return <GameScreen />;
      case 'gameOver':
        return <GameOverScreen />;
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden">
      {renderGameScreen()}
    </div>
  );
};

export default CardGame;