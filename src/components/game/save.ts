import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { FruitType, Item, ItemType } from './types';

/**
 * Progresso salvo do jogador.
 * - "personal": vale em qualquer partida (moedas, itens da loja, roupa equipada)
 * - "world": o mundo solo (semente + blocos mudados) e tudo o que o jogador tinha nele
 * Fica no aparelho (localStorage) e, com conta, também no servidor (tabela player_saves),
 * para continuar em outro celular/computador.
 */
export interface GameSave {
  v: 1;
  savedAt: number;
  personal: {
    voxelCoins: number;
    ownedItems: string[];
    equippedItems: Record<string, string | null>;
  };
  world: WorldSave | null;
}

export interface WorldSave {
  seed: number;
  edits: [number, number, number, string | null][];
  player: { x: number; y: number; z: number; health: number; hunger: number };
  inventory: { items: Item[]; hotbar: (ItemType | null)[]; selected: number };
  score: number;
  blocksDestroyed: number;
  mobsKilled: number;
  collectedFruits: FruitType[];
  fruitsTaken: string[];
  coinsTaken: string[];
  guardiansDefeated: string[];
  time: number;
}

const key = (playerId: string) => `minefruits:save:${playerId}`;
/** Limite de segurança: mundos gigantes não travam o salvamento. */
const MAX_EDITS = 40000;

function valid(s: unknown): s is GameSave {
  const g = s as GameSave;
  return !!g && g.v === 1 && typeof g.savedAt === 'number' && !!g.personal;
}

export function loadLocalSave(playerId: string): GameSave | null {
  try {
    const raw = localStorage.getItem(key(playerId));
    const parsed = raw ? JSON.parse(raw) : null;
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocal(playerId: string, save: GameSave): boolean {
  try {
    if (save.world && save.world.edits.length > MAX_EDITS) save.world.edits = save.world.edits.slice(-MAX_EDITS);
    localStorage.setItem(key(playerId), JSON.stringify(save));
    return true;
  } catch {
    return false; // armazenamento cheio ou bloqueado (aba anônima)
  }
}

export function clearLocalWorld(playerId: string) {
  const s = loadLocalSave(playerId);
  if (s) saveLocal(playerId, { ...s, world: null, savedAt: Date.now() });
}

/** Salvamento na conta. Devolve false se o servidor ainda não tem a tabela. */
export async function saveCloud(userId: string, save: GameSave): Promise<boolean> {
  const { error } = await supabase
    .from('player_saves')
    .upsert({ user_id: userId, data: save as unknown as Json, updated_at: new Date(save.savedAt).toISOString() }, { onConflict: 'user_id' });
  return !error;
}

export async function loadCloudSave(userId: string): Promise<GameSave | null> {
  const { data, error } = await supabase.from('player_saves').select('data').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  const parsed = data.data as unknown;
  return valid(parsed) ? parsed : null;
}

/** O mais novo entre o do aparelho e o da conta. */
export function newest(a: GameSave | null, b: GameSave | null): GameSave | null {
  if (!a) return b;
  if (!b) return a;
  return b.savedAt > a.savedAt ? b : a;
}

/** "há 5 min", "ontem"... para o botão Continuar. */
export function savedAgo(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
