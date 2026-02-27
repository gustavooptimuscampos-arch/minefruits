import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StartScreen } from '@/components/game/StartScreen';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Lobby } from '@/components/game/Lobby';
import { SkinCreator } from '@/components/game/SkinCreator';
import { SkinData, SKINS } from '@/components/game/skins';
import Auth from './Auth';

type Screen = 'start' | 'lobby' | 'game' | 'skin-creator';

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('start');
  const [selectedSkin, setSelectedSkin] = useState<SkinData>(SKINS[0]);
  const [customSkins, setCustomSkins] = useState<SkinData[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [isSinglePlayer, setIsSinglePlayer] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (session?.user?.user_metadata?.display_name) {
        setPlayerName(session.user.user_metadata.display_name);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user?.user_metadata?.display_name) {
        setPlayerName(session.user.user_metadata.display_name);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-pixel text-primary text-lg animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

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

  const handleSaveCustomSkin = (skin: SkinData) => {
    setCustomSkins(prev => [...prev, skin]);
    setSelectedSkin(skin);
    setScreen('start');
  };

  const handleExitGame = () => {
    setScreen('start');
    if (document.pointerLockElement) document.exitPointerLock();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (screen === 'skin-creator') {
    return <SkinCreator onSave={handleSaveCustomSkin} onBack={() => setScreen('start')} />;
  }

  if (screen === 'lobby') {
    return <Lobby skin={selectedSkin} onJoinRoom={handleJoinRoom} onBack={() => setScreen('start')} />;
  }

  if (screen === 'game') {
    return (
      <GameCanvas
        skin={selectedSkin}
        multiplayer={!isSinglePlayer ? { roomCode: roomCode!, playerName } : undefined}
        onExit={handleExitGame}
      />
    );
  }

  return (
    <div className="relative">
      {/* Logout button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleLogout}
          className="font-pixel text-[10px] px-3 py-1.5 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
        >
          🚪 Sair ({playerName})
        </button>
      </div>
      <StartScreen
        onStart={handleStart}
        customSkins={customSkins}
        onCreateSkin={() => setScreen('skin-creator')}
      />
    </div>
  );
};

export default Index;
