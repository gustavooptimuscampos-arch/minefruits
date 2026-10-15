import { describe, it, expect, beforeEach } from 'vitest';
import { loadCharges, saveLocalCharges, ownedPowers, cleanCharges, POWER_USES, ICE_FREEZE_SECONDS, FRUIT_POWERS } from '@/components/game/powers';

describe('poderes com usos limitados', () => {
  beforeEach(() => localStorage.clear());

  it('cada fruta dá 10 usos; o Gelo congela por 20 s', () => {
    expect(POWER_USES).toBe(10);
    expect(ICE_FREEZE_SECONDS).toBe(20);
    expect(FRUIT_POWERS.ice.description).toContain('20 segundos');
  });

  it('os usos que sobram ficam salvos para a próxima partida', () => {
    saveLocalCharges('ana', { flame: 7, ice: 10 });
    expect(loadCharges('ana')).toEqual({ flame: 7, ice: 10 });
    expect(ownedPowers(loadCharges('ana'))).toEqual(['flame', 'ice']);
  });

  it('poder com 0 usos some da lista', () => {
    expect(ownedPowers({ flame: 0, dark: 2 })).toEqual(['dark']);
  });

  it('quem tinha poder "para sempre" (versão antiga) ganha 10 usos de cada', () => {
    localStorage.setItem('minefruits:poderes:ana', JSON.stringify(['light', 'rubber']));
    expect(loadCharges('ana')).toEqual({ light: 10, rubber: 10 });
    expect(cleanCharges(['flame'])).toEqual({ flame: 10 });
  });

  it('o aparelho vale primeiro; sem nada nele, usa o da conta', () => {
    expect(loadCharges('ana', { dark: 4 })).toEqual({ dark: 4 });
    saveLocalCharges('ana', { dark: 2 });
    expect(loadCharges('ana', { dark: 4 })).toEqual({ dark: 2 });
  });

  it('cada jogador tem os seus poderes', () => {
    saveLocalCharges('ana', { rubber: 5 });
    expect(loadCharges('bia')).toEqual({});
  });

  it('ignora dados estranhos', () => {
    localStorage.setItem('minefruits:poderes:ana', '{quebrado');
    expect(loadCharges('ana', 'nada')).toEqual({});
    expect(loadCharges('ana', { flame: 3, hack: 9, ice: -2 })).toEqual({ flame: 3 });
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
