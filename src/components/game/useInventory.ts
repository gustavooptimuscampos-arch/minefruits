import { useState, useCallback, useRef } from 'react';
import { Item, ItemType, CRAFT_RECIPES, BLOCK_DROPS, BlockType, MINING_REQUIREMENTS } from './types';

export const HOTBAR_SIZE = 9;

/**
 * Inventário do jogador.
 * Tudo o que ele pega (blocos, comida, ferramentas, espadas) entra na barra de
 * baixo (os 9 primeiros espaços) enquanto houver espaço livre, como no Minecraft.
 * Quando um item acaba, o espaço dele na barra fica livre de novo.
 */
export function useInventory() {
  const [items, setItemsState] = useState<Item[]>([]);
  const [hotbar, setHotbarState] = useState<(ItemType | null)[]>(Array(HOTBAR_SIZE).fill(null));
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [craftingOpen, setCraftingOpen] = useState(false);

  // Cópias síncronas: vários itens podem entrar no mesmo instante (antes do React redesenhar)
  const itemsRef = useRef(items);
  const hotbarRef = useRef(hotbar);
  const setItems = useCallback((next: Item[]) => { itemsRef.current = next; setItemsState(next); }, []);
  const setHotbar = useCallback((next: (ItemType | null)[] | ((prev: (ItemType | null)[]) => (ItemType | null)[])) => {
    const value = typeof next === 'function' ? next(hotbarRef.current) : next;
    hotbarRef.current = value;
    setHotbarState(value);
  }, []);

  const countOf = useCallback((type: ItemType) => itemsRef.current.find(i => i.type === type)?.count ?? 0, []);

  const addItem = useCallback((type: ItemType, count = 1) => {
    const prev = itemsRef.current;
    const existing = prev.find(i => i.type === type);
    setItems(existing
      ? prev.map(i => i.type === type ? { ...i, count: i.count + count } : i)
      : [...prev, { type, count }]);
    // Item novo vai para o primeiro espaço livre da barra
    if (!hotbarRef.current.includes(type)) {
      const empty = hotbarRef.current.indexOf(null);
      if (empty >= 0) {
        const next = [...hotbarRef.current];
        next[empty] = type;
        setHotbar(next);
      }
    }
  }, [setItems, setHotbar]);

  const removeItem = useCallback((type: ItemType, count = 1): boolean => {
    const prev = itemsRef.current;
    const existing = prev.find(i => i.type === type);
    if (!existing || existing.count < count) return false;
    if (existing.count === count) {
      setItems(prev.filter(i => i.type !== type));
      // Acabou: libera o espaço da barra
      if (hotbarRef.current.includes(type)) setHotbar(hotbarRef.current.map(s => (s === type ? null : s)));
    } else {
      setItems(prev.map(i => i.type === type ? { ...i, count: i.count - count } : i));
    }
    return true;
  }, [setItems, setHotbar]);

  const hasItem = useCallback((type: ItemType, count = 1): boolean => {
    const item = items.find(i => i.type === type);
    return !!item && item.count >= count;
  }, [items]);

  const getItemCount = useCallback((type: ItemType): number => {
    return items.find(i => i.type === type)?.count || 0;
  }, [items]);

  const craft = useCallback((recipeIndex: number): boolean => {
    const recipe = CRAFT_RECIPES[recipeIndex];
    if (!recipe) return false;

    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      if (countOf(itemType as ItemType) < (count as number)) return false;
    }
    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      removeItem(itemType as ItemType, count as number);
    }
    // O resultado (espada, picareta, bloco...) vai para a barra como qualquer item
    addItem(recipe.result, recipe.resultCount);
    return true;
  }, [removeItem, addItem, countOf]);

  const canCraft = useCallback((recipeIndex: number): boolean => {
    const recipe = CRAFT_RECIPES[recipeIndex];
    if (!recipe) return false;
    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      if (!hasItem(itemType as ItemType, count as number)) return false;
    }
    return true;
  }, [hasItem]);

  const collectBlock = useCallback((blockType: BlockType, equippedTool: ItemType | null): boolean => {
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements && (!equippedTool || !requirements.includes(equippedTool))) {
      return false; // Precisa de uma ferramenta melhor
    }
    const drop = BLOCK_DROPS[blockType];
    if (drop) addItem(drop);
    return true;
  }, [addItem]);

  const equippedItem = hotbar[selectedSlot];

  return {
    items,
    hotbar,
    setHotbar,
    selectedSlot,
    setSelectedSlot,
    addItem,
    removeItem,
    hasItem,
    getItemCount,
    craft,
    canCraft,
    collectBlock,
    equippedItem,
    craftingOpen,
    setCraftingOpen,
  };
}
