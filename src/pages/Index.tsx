import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { StartScreen } from '@/components/game/StartScreen';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Lobby } from '@/components/game/Lobby';
import { SkinCreator } from '@/components/game/SkinCreator';
import { SkinData, SKINS } from '@/components/game/skins';
import Auth from './Auth';
import { InstallButton } from '@/components/InstallButton';
import { isTouchDevice } from '@/components/game/touchInput';
import { NickSetup } from '@/components/game/NickSetup';
import { FriendsPanel } from '@/components/game/FriendsPanel';
import { useSocial } from '@/hooks/useSocial';
import { GameSave, loadCloudSave, loadLocalSave, newest, savedAgo } from '@/components/game/save';

/** No celular, o jogo ocupa a tela toda e fica deitado. */
function enterMobileFullscreen() {
  if (!isTouchDevice) return;
  const el = document.documentElement;
  const done = el.requestFullscreen ? el.requestFullscreen().catch(() => {}) : Promise.resolve();
  done.then(() => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation?.lock?.('landscape').catch(() => {});
  });
}

type Screen = 'start' | 'lobby' | 'game' | 'skin-creator' | 'nick';

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('start');
  const [selectedSkin, setSelectedSkin] = useState<SkinData>(SKINS[0]);
  const [customSkins, setCustomSkins] = useState<SkinData[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [isSinglePlayer, setIsSinglePlayer] = useState(true);
  const [guest, setGuest] = useState(false);
  // Ao voltar do criador de skin, reabre direto a escolha de skin (com a nova selecionada)
  const [openSkinPicker, setOpenSkinPicker] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  // Progresso salvo e escolha "Continuar / Mundo novo"
  const [save, setSave] = useState<GameSave | null>(null);
  const [continueWorld, setContinueWorld] = useState(false);
  const [worldChoice, setWorldChoice] = useState<null | 'ask' | 'confirm-new'>(null);
  const [gameKey, setGameKey] = useState(0);

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

  // Nick e amigos (só para quem tem conta)
  const userId = session && !guest ? session.user.id : null;
  const social = useSocial(
    userId,
    (session?.user?.user_metadata?.nick as string | undefined) ?? null,
    screen === 'game' && !isSinglePlayer ? roomCode : null,
  );
  const playerId = session && !guest ? session.user.id : 'visitante';
  // Carrega o progresso: o do aparelho na hora; com conta, também o da nuvem (fica o mais novo)
  useEffect(() => {
    if (screen === 'game') return; // durante a partida o jogo cuida do salvamento
    const local = loadLocalSave(playerId);
    setSave(local);
    if (playerId === 'visitante') return;
    let cancelled = false;
    loadCloudSave(playerId).then(cloud => { if (!cancelled) setSave(newest(loadLocalSave(playerId), cloud)); });
    return () => { cancelled = true; };
  }, [playerId, screen]);

  // Os outros jogadores veem o nick, nunca o nome real
  const shownName = userId ? (social.nick ?? playerName) : playerName;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-pixel text-primary text-lg animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!session && !guest) {
    return (
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <InstallButton />
        </div>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 short:bottom-auto short:top-4 short:left-auto short:right-4 short:translate-x-0">
          <button
            onClick={() => { setGuest(true); setPlayerName('Visitante'); }}
            className="font-pixel text-xs px-4 py-2 bg-primary text-primary-foreground rounded shadow-lg hover:opacity-90"
          >
            🎮 Jogar como visitante
          </button>
        </div>
        <Auth />
      </div>
    );
  }

  // Conta sem nick ainda: escolhe um antes de jogar
  if (userId && social.nickLoaded && !social.nick) {
    return (
      <NickSetup
        social={social}
        email={session?.user?.email}
        onLogout={() => { supabase.auth.signOut(); }}
        onDone={() => setScreen('start')}
      />
    );
  }
  if (screen === 'nick' && userId) {
    return <NickSetup social={social} current={social.nick} email={session?.user?.email} onDone={() => { setScreen('start'); setFriendsOpen(true); }} onCancel={() => { setScreen('start'); setFriendsOpen(true); }} />;
  }

  const friendsPanel = friendsOpen && (
    <FriendsPanel
      social={userId ? social : null}
      onCreateAccount={() => { setFriendsOpen(false); setGuest(false); }}
      onChangeNick={() => { setFriendsOpen(false); setScreen('nick'); }}
      onJoinRoom={code => { setFriendsOpen(false); handleJoinRoom(code, shownName); }}
      onClose={() => setFriendsOpen(false)}
    />
  );

  const handleStart = (skin: SkinData, mode: 'single' | 'multi') => {
    setSelectedSkin(skin);
    enterMobileFullscreen();
    if (mode === 'multi') {
      setScreen('lobby');
    } else if (newest(loadLocalSave(playerId), save)?.world) {
      // Tem mundo salvo: pergunta se continua ou começa outro (relê o aparelho: pode ter mudado)
      setSave(newest(loadLocalSave(playerId), save));
      setWorldChoice('ask');
    } else {
      startSolo(false);
    }
  };

  function startSolo(cont: boolean) {
    setWorldChoice(null);
    setContinueWorld(cont);
    setIsSinglePlayer(true);
    setGameKey(k => k + 1);
    enterMobileFullscreen();
    setScreen('game');
  }

  const handleJoinRoom = (code: string, name: string) => {
    setRoomCode(code);
    setPlayerName(name);
    setIsSinglePlayer(false);
    setGameKey(k => k + 1);
    enterMobileFullscreen();
    setScreen('game');
  };

  const handleSaveCustomSkin = (skin: SkinData) => {
    setCustomSkins(prev => [...prev, skin]);
    setSelectedSkin(skin);
    setOpenSkinPicker(true);
    setScreen('start');
  };

  const handleExitGame = () => {
    setOpenSkinPicker(false);
    setScreen('start');
    if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const handleLogout = async () => {
    if (guest) { setGuest(false); return; }
    await supabase.auth.signOut();
  };

  if (screen === 'skin-creator') {
    return <SkinCreator onSave={handleSaveCustomSkin} onBack={() => { setOpenSkinPicker(true); setScreen('start'); }} />;
  }

  if (screen === 'lobby') {
    return (
      <>
        <Lobby
          skin={selectedSkin}
          defaultName={guest ? '' : shownName}
          lockedName={!!userId && !!social.nick}
          friendsInRooms={userId ? social.friends.filter(f => f.room) : []}
          pendingRequests={userId ? social.incoming.length : 0}
          onOpenFriends={() => setFriendsOpen(true)}
          onJoinRoom={handleJoinRoom}
          onBack={() => { setOpenSkinPicker(true); setScreen('start'); }}
        />
        {friendsPanel}
      </>
    );
  }

  if (screen === 'game') {
    return (
      <GameCanvas
        key={gameKey}
        save={save}
        continueWorld={continueWorld}
        skin={selectedSkin}
        playerId={playerId}
        savedPowers={session?.user?.user_metadata?.fruit_powers}
        loggedIn={!!session && !guest}
        multiplayer={!isSinglePlayer ? { roomCode: roomCode!, playerName: userId ? shownName : playerName } : undefined}
        onExit={handleExitGame}
      />
    );
  }

  return (
    <div className="relative">
      {/* Install button */}
      <div className="absolute top-4 left-4 z-50">
        <InstallButton />
      </div>
      {/* Amigos + sair */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setFriendsOpen(true)}
          className="relative font-pixel text-[10px] px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
        >
          👥 Amigos
          {userId && social.incoming.length > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">
              {social.incoming.length}
            </span>
          )}
        </button>
        <button
          onClick={handleLogout}
          className="font-pixel text-[10px] px-3 py-1.5 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
        >
          🚪 {guest ? 'Entrar / criar conta' : `Sair (@${shownName})`}
        </button>
      </div>
      {friendsPanel}
      {worldChoice && save?.world && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={() => setWorldChoice(null)}>
          <div role="dialog" aria-label="Mundo salvo" className="w-full max-w-sm rounded-xl bg-card border border-border p-5 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            {worldChoice === 'ask' ? (
              <>
                <h2 className="font-pixel text-base text-primary mb-2">💾 MUNDO SALVO</h2>
                <p className="font-game text-xs text-muted-foreground mb-4">
                  Salvo {savedAgo(save.savedAt)} · {save.world.score} pontos · {save.world.collectedFruits.length} frutas · {save.world.inventory.items.reduce((n, i) => n + i.count, 0)} itens
                </p>
                <div className="flex flex-col gap-2">
                  <button autoFocus onClick={() => startSolo(true)} className="font-pixel text-xs px-4 py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:opacity-90">
                    ▶ CONTINUAR
                  </button>
                  <button onClick={() => setWorldChoice('confirm-new')} className="font-pixel text-[10px] px-4 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80">
                    🌍 Mundo novo
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-pixel text-sm text-destructive mb-2">⚠️ COMEÇAR DO ZERO?</h2>
                <p className="font-game text-xs text-muted-foreground mb-4">
                  O mundo salvo, o inventário e as frutas pegas nele serão apagados. Suas moedas, itens da loja e poderes continuam.
                </p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => startSolo(false)} className="font-pixel text-[10px] px-4 py-3 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90">
                    Sim, mundo novo
                  </button>
                  <button autoFocus onClick={() => setWorldChoice('ask')} className="font-pixel text-[10px] px-4 py-2.5 bg-muted rounded-lg hover:bg-muted/80">
                    ← Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <StartScreen
        onStart={handleStart}
        customSkins={customSkins}
        initialSkin={selectedSkin}
        startOnSkins={openSkinPicker}
        onCreateSkin={() => setScreen('skin-creator')}
      />
    </div>
  );
};

export default Index;
