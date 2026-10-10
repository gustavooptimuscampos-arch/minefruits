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

/** Poderes das frutas (estilo Blox Fruits). Tecla F no computador, botão ✨ no celular. */
export const FRUIT_POWERS: Record<FruitType, FruitPower> = {
  flame:  { name: 'Fogo',     emoji: '🔥', description: 'Bola de fogo que queima os monstros à sua frente', cooldown: 3,  damage: 30 },
  ice:    { name: 'Gelo',     emoji: '❄️', description: 'Congela os monstros em volta por 5 segundos',      cooldown: 8,  damage: 12 },
  light:  { name: 'Luz',      emoji: '⚡', description: 'Teleporte de 12 blocos para a frente; corre mais rápido', cooldown: 4, damage: 0 },
  dark:   { name: 'Trevas',   emoji: '🌑', description: 'Buraco negro que machuca todos em volta e recupera sua vida', cooldown: 10, damage: 20 },
  rubber: { name: 'Borracha', emoji: '🩷', description: 'Soco esticado que acerta longe; pula muito mais alto', cooldown: 2, damage: 25 },
};
