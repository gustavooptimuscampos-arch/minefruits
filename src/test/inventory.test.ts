import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInventory } from '@/components/game/useInventory';
import { CRAFT_RECIPES, PLACEABLE, BLOCK_DROPS, BlockType } from '@/components/game/types';

describe('inventário principal (barra de baixo)', () => {
  it('tudo o que pega vai para o primeiro espaço livre da barra', () => {
    const { result } = renderHook(() => useInventory());
    act(() => { result.current.addItem('dirt', 3); });
    act(() => { result.current.addItem('beef', 1); });
    act(() => { result.current.addItem('dirt', 2); });
    expect(result.current.hotbar.slice(0, 3)).toEqual(['dirt', 'beef', null]);
    expect(result.current.items.find(i => i.type === 'dirt')?.count).toBe(5);
  });

  it('item que acaba libera o espaço da barra', () => {
    const { result } = renderHook(() => useInventory());
    act(() => { result.current.addItem('dirt', 1); result.current.addItem('sand', 1); });
    act(() => { result.current.removeItem('dirt', 1); });
    expect(result.current.hotbar.slice(0, 2)).toEqual([null, 'sand']);
    act(() => { result.current.addItem('cobblestone', 1); });
    expect(result.current.hotbar.slice(0, 2)).toEqual(['cobblestone', 'sand']);
  });

  it('espada craftada vai para a barra, e os ingredientes gastos saem dela', () => {
    const { result } = renderHook(() => useInventory());
    const sword = CRAFT_RECIPES.findIndex(r => r.result === 'wood_sword');
    act(() => { result.current.addItem('planks', 2); result.current.addItem('stick', 1); });
    act(() => { result.current.craft(sword); });
    expect(result.current.hotbar).toContain('wood_sword');
    expect(result.current.hotbar).not.toContain('planks');
    expect(result.current.hotbar).not.toContain('stick');
  });

  it('a barra enche (9 espaços); o resto continua no inventário', () => {
    const { result } = renderHook(() => useInventory());
    const many = ['dirt', 'sand', 'sandstone', 'snow', 'ice', 'cobblestone', 'planks', 'wood', 'leaves', 'cactus'] as const;
    act(() => { many.forEach(t => result.current.addItem(t, 1)); });
    expect(result.current.hotbar.every(Boolean)).toBe(true);
    expect(result.current.items).toHaveLength(10);
  });

  it('todo bloco quebrado que dá para colocar volta a ser bloco', () => {
    for (const block of ['dirt', 'stone', 'sand', 'wood', 'planks', 'cobblestone'] as BlockType[]) {
      const item = BLOCK_DROPS[block]!;
      expect(PLACEABLE[item], `${block} -> ${item}`).toBeTruthy();
    }
  });
});
