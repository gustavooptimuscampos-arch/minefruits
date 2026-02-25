import { useState, useCallback } from 'react';
import { Item, ItemType, CRAFT_RECIPES, BLOCK_DROPS, BlockType, MINING_REQUIREMENTS } from './types';

export function useInventory() {
  const [items, setItems] = useState<Item[]>([]);
  const [hotbar, setHotbar] = useState<(ItemType | null)[]>([null, null, null, null, null, null, null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [craftingOpen, setCraftingOpen] = useState(false);

  const addItem = useCallback((type: ItemType, count = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.type === type);
      if (existing) {
        return prev.map(i => i.type === type ? { ...i, count: i.count + count } : i);
      }
      return [...prev, { type, count }];
    });
  }, []);

  const removeItem = useCallback((type: ItemType, count = 1): boolean => {
    let success = false;
    setItems(prev => {
      const existing = prev.find(i => i.type === type);
      if (!existing || existing.count < count) return prev;
      success = true;
      if (existing.count === count) {
        return prev.filter(i => i.type !== type);
      }
      return prev.map(i => i.type === type ? { ...i, count: i.count - count } : i);
    });
    return success;
  }, []);

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

    // Check ingredients
    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      if (!hasItem(itemType as ItemType, count as number)) return false;
    }

    // Consume ingredients
    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      removeItem(itemType as ItemType, count as number);
    }

    // Add result
    addItem(recipe.result, recipe.resultCount);

    // Auto-equip tools/weapons to first empty hotbar slot
    if (recipe.category === 'tool' || recipe.category === 'weapon') {
      setHotbar(prev => {
        const emptySlot = prev.findIndex(s => s === null);
        if (emptySlot >= 0) {
          const next = [...prev];
          next[emptySlot] = recipe.result;
          return next;
        }
        return prev;
      });
    }

    return true;
  }, [hasItem, removeItem, addItem]);

  const canCraft = useCallback((recipeIndex: number): boolean => {
    const recipe = CRAFT_RECIPES[recipeIndex];
    if (!recipe) return false;
    for (const [itemType, count] of Object.entries(recipe.ingredients)) {
      if (!hasItem(itemType as ItemType, count as number)) return false;
    }
    return true;
  }, [hasItem]);

  const collectBlock = useCallback((blockType: BlockType, equippedTool: ItemType | null): boolean => {
    // Check mining requirements
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements && (!equippedTool || !requirements.includes(equippedTool))) {
      return false; // Need better tool
    }

    const drop = BLOCK_DROPS[blockType];
    if (drop) {
      addItem(drop);
      return true;
    }
    return true; // Block broken but no drop
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
