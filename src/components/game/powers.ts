import { FruitType } from './types';

export interface FruitPower {
  name: string;
  emoji: string;
  /** O que o poder faz (aparece no HUD e na tela de ajuda). */
  description: string;
  /** Segundos até poder usar de novo. */
  cooldown: number;
  damage: number;
}

/** Quanto tempo o Gelo deixa os monstros congelados. */
export const ICE_FREEZE_SECONDS = 20;

/** Poderes das frutas (estilo Blox Fruits). Tecla F no computador, botão ✨ no celular. */
export const FRUIT_POWERS: Record<FruitType, FruitPower> = {
  flame:  { name: 'Fogo',     emoji: '🔥', description: 'Bola de fogo que queima os monstros à sua frente', cooldown: 3,  damage: 30 },
  ice:    { name: 'Gelo',     emoji: '❄️', description: `Congela os monstros em volta por ${ICE_FREEZE_SECONDS} segundos`, cooldown: 8,  damage: 12 },
  light:  { name: 'Luz',      emoji: '⚡', description: 'Teleporte de 12 blocos para a frente; corre mais rápido', cooldown: 4, damage: 0 },
  dark:   { name: 'Trevas',   emoji: '🌑', description: 'Buraco negro que machuca todos em volta e recupera sua vida', cooldown: 10, damage: 20 },
  rubber: { name: 'Borracha', emoji: '🩷', description: 'Soco esticado que acerta longe; pula muito mais alto', cooldown: 2, damage: 25 },
};

export const ALL_POWERS: FruitType[] = ['flame', 'ice', 'light', 'dark', 'rubber'];
const ALL = ALL_POWERS;

/** Quantas vezes cada fruta deixa usar o poder. Acabou: a fruta volta para o lugar dela. */
export const POWER_USES = 10;

/** Usos que sobram de cada poder (só aparecem os que têm usos). */
export type PowerCharges = Partial<Record<FruitType, number>>;

const storageKey = (playerId: string) => `minefruits:poderes:${playerId}`;

/**
 * Limpa o que veio de fora (memória do navegador ou da conta).
 * Aceita o formato antigo (lista de poderes "para sempre"): cada um vira 10 usos.
 */
export function cleanCharges(value: unknown): PowerCharges | null {
  if (Array.isArray(value)) {
    return Object.fromEntries(ALL.filter(t => value.includes(t)).map(t => [t, POWER_USES]));
  }
  if (value && typeof value === 'object') {
    const out: PowerCharges = {};
    for (const t of ALL) {
      const n = Math.floor(Number((value as Record<string, unknown>)[t]));
      if (n > 0) out[t] = Math.min(n, 99);
    }
    return out;
  }
  return null;
}

/** Poderes com usos sobrando, na ordem fixa. */
export function ownedPowers(charges: PowerCharges): FruitType[] {
  return ALL.filter(t => (charges[t] ?? 0) > 0);
}

/**
 * Usos de cada poder: o salvo neste aparelho vale primeiro (é o mais recente);
 * sem nada aqui, usa o da conta (outro aparelho).
 */
export function loadCharges(playerId: string, fromAccount?: unknown): PowerCharges {
  let local: unknown = null;
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    local = raw ? JSON.parse(raw) : null;
  } catch { /* sem memória do navegador */ }
  return cleanCharges(local) ?? cleanCharges(fromAccount) ?? {};
}

export function saveLocalCharges(playerId: string, charges: PowerCharges) {
  try { localStorage.setItem(storageKey(playerId), JSON.stringify(charges)); } catch { /* sem memória do navegador */ }
}
