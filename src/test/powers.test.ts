import { describe, it, expect, beforeEach } from 'vitest';
import { loadPowers, saveLocalPowers, cleanUses, usablePowers, POWER_USES, ICE_FREEZE_SECONDS, FRUIT_POWERS } from '@/components/game/powers';

describe('poderes: fruta inicial (10 usos) e fruta do Guardião (para sempre)', () => {
  beforeEach(() => localStorage.clear());

  it('fruta inicial dá 10 usos; o Gelo congela por 20 s', () => {
    expect(POWER_USES).toBe(10);
    expect(ICE_FREEZE_SECONDS).toBe(20);
    expect(FRUIT_POWERS.ice.description).toContain('20 segundos');
  });

  it('o poder ganho continua salvo (para sempre)', () => {
    saveLocalPowers('ana', ['flame', 'ice']);
    expect(loadPowers('ana')).toEqual(['flame', 'ice']);
  });

  it('fruta inicial dá usos; fruta do Guardião é para sempre', () => {
    // Fogo para sempre (Guardião) + 3 usos de Gelo (fruta inicial); Trevas sem usos não aparece
    expect(usablePowers(['flame'], { ice: 3, dark: 0 })).toEqual(['flame', 'ice']);
    expect(usablePowers([], {})).toEqual([]);
  });

  it('usos salvos no mundo são limpos ao carregar', () => {
    expect(cleanUses({ ice: 3, dark: 0, hack: 5, flame: 500 })).toEqual({ ice: 3, flame: 99 });
    expect(cleanUses(null)).toEqual({});
  });

  it('junta o que está no aparelho com o que está na conta', () => {
    saveLocalPowers('ana', ['dark']);
    expect(loadPowers('ana', ['light', 'dark'])).toEqual(['light', 'dark']);
  });

  it('aceita o formato da versão de teste com usos ({ fogo: 7 })', () => {
    localStorage.setItem('minefruits:poderes:ana', JSON.stringify({ rubber: 7 }));
    expect(loadPowers('ana')).toEqual(['rubber']);
  });

  it('cada jogador tem os seus poderes; ignora dados estranhos', () => {
    saveLocalPowers('ana', ['rubber']);
    expect(loadPowers('bia')).toEqual([]);
    localStorage.setItem('minefruits:poderes:bia', '{quebrado');
    expect(loadPowers('bia', 'nada')).toEqual([]);
    expect(loadPowers('bia', ['flame', 'hack'])).toEqual(['flame']);
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
