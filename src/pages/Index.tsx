import { useState } from 'react';
import { StartScreen } from '@/components/game/StartScreen';
import { GameCanvas } from '@/components/game/GameCanvas';
import { SkinData, SKINS } from '@/components/game/skins';

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<SkinData>(SKINS[0]);

  const handleStart = (skin: SkinData) => {
    setSelectedSkin(skin);
    setGameStarted(true);
  };

  if (!gameStarted) {
    return <StartScreen onStart={handleStart} />;
  }

  return <GameCanvas skin={selectedSkin} />;
};

export default Index;
