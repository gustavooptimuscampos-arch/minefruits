import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from './GameChat';
import { SkinData } from './skins';

export interface RemotePlayer {
  id: string;
  name: string;
  skinId: string;
  position: [number, number, number];
  rotation: number;
  isMoving: boolean;
  health: number;
}

interface UseMultiplayerOptions {
  roomCode: string;
  playerName: string;
  skin: SkinData;
  /** false no modo solo: não abre conexão com o servidor. */
  enabled?: boolean;
}

interface PresencePayload {
  name?: string;
  skinId?: string;
  position?: [number, number, number];
  rotation?: number;
  isMoving?: boolean;
  health?: number;
}

/** Envia no máximo 10 atualizações de posição por segundo (o Supabase Realtime limita a taxa). */
const POSITION_INTERVAL_MS = 100;

const sysId = () => `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useMultiplayer({ roomCode, playerName, skin, enabled = true }: UseMultiplayerOptions) {
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myIdRef = useRef(`player-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const lastSentRef = useRef(0);

  useEffect(() => {
    // Modo solo: antes todos os jogadores solo entravam juntos no canal "game-room-single".
    if (!enabled) return;
    const channel = supabase.channel(`game-room-${roomCode}`, {
      config: { presence: { key: myIdRef.current } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        // Mantém a posição que já chegou por broadcast: a presença guarda só a posição
        // inicial, e usar ela faria todo mundo "teleportar" quando alguém entra ou sai.
        setRemotePlayers(prev => {
          const players: RemotePlayer[] = [];
          Object.entries(state).forEach(([key, presences]) => {
            if (key === myIdRef.current) return;
            const p = presences[0];
            if (!p) return;
            const known = prev.find(r => r.id === key);
            players.push(known ?? {
              id: key,
              name: p.name || 'Player',
              skinId: p.skinId || 'steve',
              position: p.position || [0, 8, 0],
              rotation: p.rotation || 0,
              isMoving: p.isMoving || false,
              health: p.health ?? 100,
            });
          });
          return players;
        });
      })
      .on('broadcast', { event: 'player_update' }, ({ payload }) => {
        if (payload.id === myIdRef.current) return;
        setRemotePlayers(prev => {
          const existing = prev.findIndex(p => p.id === payload.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], ...payload };
            return updated;
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'player_attack' }, () => {
        // Ataques remotos ainda não têm efeito no jogo
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload.senderId === myIdRef.current) return;
        setChatMessages(prev => [...prev.slice(-49), {
          id: payload.id,
          sender: payload.sender,
          text: payload.text,
          timestamp: payload.timestamp,
          isSystem: payload.isSystem,
        }]);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const joined = newPresences[0] as PresencePayload | undefined;
        if (joined) {
          setChatMessages(prev => [...prev.slice(-49), {
            id: sysId(),
            sender: '',
            text: `${joined.name || 'Alguém'} entrou na sala`,
            timestamp: Date.now(),
            isSystem: true,
          }]);
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const left = leftPresences[0] as PresencePayload | undefined;
        if (left) {
          setChatMessages(prev => [...prev.slice(-49), {
            id: sysId(),
            sender: '',
            text: `${left.name || 'Alguém'} saiu da sala`,
            timestamp: Date.now(),
            isSystem: true,
          }]);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: playerName,
            skinId: skin.id,
            position: [0, 8, 0],
            rotation: 0,
            isMoving: false,
            health: 100,
          });
          setConnected(true);
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      setConnected(false);
      setRemotePlayers([]);
      channel.unsubscribe();
    };
  }, [roomCode, playerName, skin.id, enabled]);

  const sendPosition = useCallback((position: [number, number, number], rotation: number, isMoving: boolean, health: number) => {
    if (!channelRef.current) return;
    const now = Date.now();
    if (now - lastSentRef.current < POSITION_INTERVAL_MS) return;
    lastSentRef.current = now;
    channelRef.current.send({
      type: 'broadcast',
      event: 'player_update',
      payload: {
        id: myIdRef.current,
        name: playerName,
        skinId: skin.id,
        position,
        rotation,
        isMoving,
        health,
      },
    });
  }, [playerName, skin.id]);

  const sendAttack = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'player_attack',
      payload: { id: myIdRef.current },
    });
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender: playerName,
      text,
      timestamp: Date.now(),
    };
    // Add locally
    setChatMessages(prev => [...prev.slice(-49), msg]);
    // Broadcast
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: { ...msg, senderId: myIdRef.current },
      });
    }
  }, [playerName]);

  return {
    remotePlayers,
    connected,
    sendPosition,
    sendAttack,
    sendChatMessage,
    chatMessages,
    myId: myIdRef.current,
  };
}
