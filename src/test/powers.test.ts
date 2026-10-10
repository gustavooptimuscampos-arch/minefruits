import { describe, it, expect, beforeEach } from 'vitest';
import { loadPowers, saveLocalPowers, FRUIT_POWERS } from '@/components/game/powers';

describe('poderes para sempre', () => {
  beforeEach(() => localStorage.clear());

  it('o poder ganho continua salvo na próxima partida', () => {
    saveLocalPowers('ana', ['flame']);
    expect(loadPowers('ana')).toEqual(['flame']);
    saveLocalPowers('ana', ['flame', 'ice']);
    expect(loadPowers('ana')).toEqual(['flame', 'ice']);
  });

  it('junta o que está no aparelho com o que está na conta', () => {
    saveLocalPowers('ana', ['dark']);
    expect(loadPowers('ana', ['light', 'dark'])).toEqual(['light', 'dark']);
  });

  it('cada jogador tem os seus poderes', () => {
    saveLocalPowers('ana', ['rubber']);
    expect(loadPowers('bia')).toEqual([]);
  });

  it('ignora dados estranhos', () => {
    localStorage.setItem('minefruits:poderes:ana', '{quebrado');
    expect(loadPowers('ana', 'nada')).toEqual([]);
    expect(loadPowers('ana', ['flame', 'hack'])).toEqual(['flame']);
  });

  it('todo poder tem nome, recarga e descrição', () => {
    for (const p of Object.values(FRUIT_POWERS)) {
      expect(p.name).toBeTruthy();
      expect(p.cooldown).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(10);
    }
  });
});

import { ANIMAL_FOOD } from '@/components/game/mobs';
import { FOOD_VALUES, ITEM_CONFIG } from '@/components/game/types';

describe('comida dos animais', () => {
  it('todo animal deixa uma comida que mata a fome', () => {
    for (const animal of ['cow', 'pig', 'sheep', 'chicken'] as const) {
      const drop = ANIMAL_FOOD[animal];
      expect(drop, animal).toBeTruthy();
      const [item, min, max] = drop!;
      expect(ITEM_CONFIG[item]).toBeTruthy();
      expect(FOOD_VALUES[item]).toBeGreaterThan(0);
      expect(min).toBeGreaterThanOrEqual(1);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });
});
