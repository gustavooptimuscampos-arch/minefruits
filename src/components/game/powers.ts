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

/** Usos que uma fruta inicial (sem Guardião) dá. A fruta do Guardião é para sempre e sem limite. */
export const POWER_USES = 10;

/** Usos que sobram dos poderes de frutas iniciais (os que ainda não são para sempre). */
export type PowerUses = Partial<Record<FruitType, number>>;

const storageKey = (playerId: string) => `minefruits:poderes:${playerId}`;

/**
 * Limpa a lista de poderes vinda de fora (memória do navegador ou da conta).
 * Aceita lista (["flame"]) ou o formato de usos ({ flame: 7 }) de uma versão de teste.
 */
export function cleanPowers(value: unknown): FruitType[] {
  if (Array.isArray(value)) return ALL.filter(t => value.includes(t));
  if (value && typeof value === 'object') return ALL.filter(t => t in (value as object));
  return [];
}

/**
 * Poderes que o jogador já ganhou, para sempre: ficam salvos neste aparelho
 * e, se ele tem conta, também na conta (vale em qualquer aparelho).
 */
export function loadPowers(playerId: string, fromAccount?: unknown): FruitType[] {
  let local: unknown = [];
  try { local = JSON.parse(localStorage.getItem(storageKey(playerId)) || '[]'); } catch { /* sem memória do navegador */ }
  const both = new Set([...cleanPowers(local), ...cleanPowers(fromAccount)]);
  return ALL.filter(t => both.has(t));
}

export function saveLocalPowers(playerId: string, powers: FruitType[]) {
  try { localStorage.setItem(storageKey(playerId), JSON.stringify(powers)); } catch { /* sem memória do navegador */ }
}

/** Limpa os usos salvos no mundo (números estranhos viram 0..99). */
export function cleanUses(saved?: unknown): PowerUses {
  const out: PowerUses = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const t of ALL) {
    const n = Math.floor(Number((saved as Record<string, unknown>)[t]));
    if (n > 0) out[t] = Math.min(n, 99);
  }
  return out;
}

/** Poderes que dá para usar: os para sempre + os de fruta inicial com usos sobrando. */
export function usablePowers(permanent: FruitType[], uses: PowerUses): FruitType[] {
  return ALL.filter(t => permanent.includes(t) || (uses[t] ?? 0) > 0);
}
