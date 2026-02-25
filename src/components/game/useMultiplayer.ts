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
}

export function useMultiplayer({ roomCode, playerName, skin }: UseMultiplayerOptions) {
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myIdRef = useRef(`player-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const channel = supabase.channel(`game-room-${roomCode}`, {
      config: { presence: { key: myIdRef.current } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const players: RemotePlayer[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (key === myIdRef.current) return;
          const p = (presences as any[])[0];
          if (p) {
            players.push({
              id: key,
              name: p.name || 'Player',
              skinId: p.skinId || 'steve',
              position: p.position || [0, 8, 0],
              rotation: p.rotation || 0,
              isMoving: p.isMoving || false,
              health: p.health ?? 100,
            });
          }
        });
        setRemotePlayers(players);
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
      .on('broadcast', { event: 'player_attack' }, ({ payload }) => {
        // Handle remote player attacks
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
        const joined = (newPresences as any[])[0];
        if (joined) {
          setChatMessages(prev => [...prev.slice(-49), {
            id: `sys-${Date.now()}`,
            sender: '',
            text: `${joined.name || 'Alguém'} entrou na sala`,
            timestamp: Date.now(),
            isSystem: true,
          }]);
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const left = (leftPresences as any[])[0];
        if (left) {
          setChatMessages(prev => [...prev.slice(-49), {
            id: `sys-${Date.now()}`,
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
      channel.unsubscribe();
    };
  }, [roomCode, playerName, skin.id]);

  const sendPosition = useCallback((position: [number, number, number], rotation: number, isMoving: boolean, health: number) => {
    if (!channelRef.current) return;
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
