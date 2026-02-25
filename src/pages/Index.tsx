import { useState } from 'react';
import { StartScreen } from '@/components/game/StartScreen';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Lobby } from '@/components/game/Lobby';
import { SkinData, SKINS } from '@/components/game/skins';

type Screen = 'start' | 'lobby' | 'game';

const Index = () => {
  const [screen, setScreen] = useState<Screen>('start');
  const [selectedSkin, setSelectedSkin] = useState<SkinData>(SKINS[0]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [isSinglePlayer, setIsSinglePlayer] = useState(true);

  const handleStart = (skin: SkinData, mode: 'single' | 'multi') => {
    setSelectedSkin(skin);
    if (mode === 'multi') {
      setScreen('lobby');
    } else {
      setIsSinglePlayer(true);
      setScreen('game');
    }
  };

  const handleJoinRoom = (code: string, name: string) => {
    setRoomCode(code);
    setPlayerName(name);
    setIsSinglePlayer(false);
    setScreen('game');
  };

  if (screen === 'lobby') {
    return (
      <Lobby
        skin={selectedSkin}
        onJoinRoom={handleJoinRoom}
        onBack={() => setScreen('start')}
      />
    );
  }

  if (screen === 'game') {
    return (
      <GameCanvas
        skin={selectedSkin}
        multiplayer={!isSinglePlayer ? { roomCode: roomCode!, playerName } : undefined}
      />
    );
  }

  return <StartScreen onStart={handleStart} />;
};

export default Index;
