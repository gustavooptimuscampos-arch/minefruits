import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SkinData } from './skins';
import gameBg from '@/assets/game-bg.jpg';
import { Room, generateRoomCode, joinRoomByCode } from '@/lib/rooms';
import type { Friend } from '@/hooks/useSocial';

interface LobbyProps {
  skin: SkinData;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onBack: () => void;
  /** Nome da conta logada, para não precisar digitar de novo. */
  defaultName?: string;
  /** Conta com nick: o nome não pode ser trocado aqui (os outros veem o nick). */
  lockedName?: boolean;
  /** Amigos que estão jogando numa sala agora. */
  friendsInRooms?: Friend[];
  pendingRequests?: number;
  onOpenFriends?: () => void;
}

export function Lobby({ skin, onJoinRoom, onBack, defaultName = '', lockedName = false, friendsInRooms = [], pendingRequests = 0, onOpenFriends }: LobbyProps) {
  const [playerName, setPlayerName] = useState(defaultName);
  useEffect(() => { if (lockedName) setPlayerName(defaultName); }, [lockedName, defaultName]);
  const [joinCode, setJoinCode] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRooms() {
    const { data, error: err } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(10);
    setOffline(!!err);
    if (data) setRooms(data as Room[]);
  }

  async function createRoom() {
    if (!playerName.trim()) {
      setError('Digite seu nome!');
      return;
    }
    setLoading(true);
    setError('');
    const code = generateRoomCode();
    const { error: err } = await supabase
      .from('game_rooms')
      .insert({ code, host_name: playerName.trim(), max_players: 4 });
    
    if (err) {
      setError('Erro ao criar sala. Tente novamente.');
      setLoading(false);
      return;
    }
    onJoinRoom(code, playerName.trim());
  }

  async function joinRoom(code: string) {
    if (!playerName.trim()) {
      setError('Digite seu nome!');
      return;
    }
    setLoading(true);
    setError('');

    const result = await joinRoomByCode(code);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onJoinRoom(result.code, playerName.trim());
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${gameBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/80" />

      <div className="relative z-10 w-full max-w-lg px-4">
        <h1 className="font-pixel text-2xl sm:text-3xl text-primary text-glow-green text-center mb-2">
          MULTIPLAYER
        </h1>
        <p className="text-center font-game text-muted-foreground text-sm mb-6">
          Jogando como: <span className="text-foreground">{skin.name}</span>
        </p>

        {/* Player name */}
        <div className="mb-6">
          {lockedName ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 border border-border px-4 py-3">
              <span className="font-game text-sm text-muted-foreground">Seu nick: <b className="text-primary">@{playerName}</b></span>
              {onOpenFriends && (
                <button onClick={onOpenFriends} className="relative font-game text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground">
                  👥 Amigos
                  {pendingRequests > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center">{pendingRequests}</span>
                  )}
                </button>
              )}
            </div>
          ) : (
            <>
              <label className="block font-game text-sm text-muted-foreground mb-2">Seu nome:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={16}
                placeholder="Digite seu nome..."
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground font-game text-sm focus:outline-none focus:border-primary"
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 rounded-lg font-game text-sm transition-colors ${
              tab === 'create' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Criar Sala
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 rounded-lg font-game text-sm transition-colors ${
              tab === 'join' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Entrar em Sala
          </button>
        </div>

        {offline && !error && (
          <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg px-3 py-2 mb-4">
            <span className="text-xs font-game text-orange-300">⚠️ Sem conexão com o servidor de salas. Verifique a internet.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            <span className="text-xs font-game text-red-300">{error}</span>
          </div>
        )}

        {tab === 'create' ? (
          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full font-pixel text-sm py-4 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              {loading ? 'Criando...' : '🎮 CRIAR SALA'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Join by code */}
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && joinCode.length === 5 && !loading) joinRoom(joinCode); }}
                maxLength={5}
                placeholder="CÓDIGO"
                className="flex-1 px-4 py-3 rounded-lg bg-muted border border-border text-foreground font-pixel text-sm text-center tracking-widest focus:outline-none focus:border-primary uppercase"
              />
              <button
                onClick={() => joinRoom(joinCode)}
                disabled={loading || joinCode.length < 5}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-game text-sm hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                Entrar
              </button>
            </div>

            {/* Amigos jogando agora */}
            {friendsInRooms.length > 0 && (
              <div className="space-y-2">
                <p className="font-game text-xs text-green-400">🟢 Amigos jogando agora:</p>
                {friendsInRooms.map(f => (
                  <button
                    key={f.id}
                    onClick={() => joinRoom(f.room!)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-green-900/20 border border-green-500/30 hover:border-green-400/60 transition-colors text-left"
                  >
                    <span className="font-game text-sm">@{f.nick} <span className="text-muted-foreground text-xs ml-2">sala {f.room}</span></span>
                    <span className="font-game text-xs text-primary">▶ Entrar</span>
                  </button>
                ))}
              </div>
            )}

            {/* Room list */}
            <div className="space-y-2">
              <p className="font-game text-xs text-muted-foreground">Salas disponíveis:</p>
              {rooms.length === 0 ? (
                <div className="text-center py-6 bg-muted/30 rounded-lg border border-border/30">
                  <p className="font-game text-sm text-muted-foreground">Nenhuma sala aberta</p>
                  <p className="font-game text-xs text-muted-foreground/60 mt-1">Crie uma sala para jogar!</p>
                </div>
              ) : (
                rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => joinRoom(room.code)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/30 hover:border-primary/50 hover:bg-muted/70 transition-colors text-left"
                  >
                    <div>
                      <span className="font-pixel text-xs text-primary">{room.code}</span>
                      <span className="font-game text-xs text-muted-foreground ml-3">Host: {room.host_name}</span>
                    </div>
                    <span className="font-game text-xs text-muted-foreground">
                      {room.current_players}/{room.max_players} 👥
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full mt-6 font-pixel text-xs py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
        >
          ← VOLTAR
        </button>
      </div>
    </div>
  );
}
