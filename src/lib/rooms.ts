import { supabase } from '@/integrations/supabase/client';

export interface Room {
  id: string;
  code: string;
  host_name: string;
  max_players: number;
  current_players: number;
  status: string;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Entra numa sala pelo código (usado pelo Lobby e pelo botão "Entrar" na sala de um amigo). */
export async function joinRoomByCode(rawCode: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  const code = rawCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('code', code)
    .eq('status', 'waiting')
    .maybeSingle();
  if (error) return { ok: false, error: 'Sem conexão com o servidor. Tente de novo.' };
  if (!data) return { ok: false, error: 'Sala não encontrada ou já iniciada.' };
  const room = data as Room;
  if (room.current_players >= room.max_players) return { ok: false, error: 'Sala cheia!' };
  await supabase.from('game_rooms').update({ current_players: room.current_players + 1 }).eq('id', room.id);
  return { ok: true, code };
}
