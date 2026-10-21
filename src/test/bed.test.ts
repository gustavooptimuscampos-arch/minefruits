import { describe, it, expect } from 'vitest';
import { CRAFT_RECIPES, PLACEABLE, BLOCK_DROPS, ITEM_CONFIG, BLOCK_COLORS } from '@/components/game/types';
import { ANIMAL_EXTRA_DROPS } from '@/components/game/mobs';

describe('cama', () => {
  it('a ovelha dá lã', () => {
    expect(ANIMAL_EXTRA_DROPS.sheep?.[0]).toBe('wool');
  });

  it('cama = 3 lãs + 3 tábuas', () => {
    const r = CRAFT_RECIPES.find(c => c.result === 'bed');
    expect(r?.ingredients).toEqual({ wool: 3, planks: 3 });
  });

  it('a cama pode ser colocada e volta para o inventário ao quebrar', () => {
    expect(PLACEABLE.bed).toBe('bed');
    expect(BLOCK_DROPS.bed).toBe('bed');
    expect(ITEM_CONFIG.bed.label).toBe('Cama');
    expect(BLOCK_COLORS.bed).toBeTruthy();
  });
});
