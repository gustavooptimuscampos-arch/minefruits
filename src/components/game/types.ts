export type BlockType =
  | 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'water' | 'snow' | 'flower'
  | 'coal_ore' | 'iron_ore' | 'copper_ore' | 'gold_ore' | 'lapis_ore' | 'diamond_ore' | 'obsidian'
  | 'netherrack' | 'netherite_ore' | 'glowstone' | 'nether_brick'
  | 'cobblestone' | 'planks' | 'torch' | 'door' | 'crafting_table';

export type FruitType = 'flame' | 'ice' | 'light' | 'dark' | 'rubber';

export type ItemType =
  | 'wood_sword' | 'stone_sword' | 'iron_sword' | 'diamond_sword'
  | 'wood_pickaxe' | 'stone_pickaxe' | 'iron_pickaxe' | 'diamond_pickaxe'
  | 'wood_axe' | 'stone_axe' | 'iron_axe' | 'diamond_axe'
  | 'shield' | 'lance' | 'torch'
  | 'wood' | 'stone' | 'cobblestone' | 'planks' | 'coal' | 'iron_ingot' | 'copper_ingot'
  | 'gold_ingot' | 'lapis' | 'diamond' | 'obsidian' | 'stick'
  | 'door' | 'crafting_table';

export interface Item {
  type: ItemType;
  count: number;
}

export interface CraftRecipe {
  result: ItemType;
  resultCount: number;
  ingredients: Partial<Record<ItemType, number>>;
  label: string;
  category: 'tool' | 'weapon' | 'block' | 'misc';
}

export interface Fruit {
  id: string;
  position: [number, number, number];
  type: FruitType;
  collected: boolean;
}

export const BLOCK_COLORS: Record<BlockType, string> = {
  grass: '#5a9e4b',
  dirt: '#7a5c2e',
  stone: '#8a8a8a',
  wood: '#5a3a1a',
  leaves: '#3a8a30',
  sand: '#d4c484',
  water: '#2196F3',
  snow: '#eef4f8',
  flower: '#e85d8a',
  coal_ore: '#3a3a3a',
  iron_ore: '#c4a882',
  copper_ore: '#b87333',
  gold_ore: '#ffd700',
  lapis_ore: '#1a3a8a',
  diamond_ore: '#4ae0e0',
  obsidian: '#1a0a2a',
  netherrack: '#8a2a2a',
  netherite_ore: '#3a2a2a',
  glowstone: '#e8c84a',
  nether_brick: '#4a2020',
  cobblestone: '#6a6a6a',
  planks: '#b8944a',
  torch: '#ffa500',
  door: '#8a6a3a',
  crafting_table: '#8a6a2a',
};

// Which items drop from which blocks
export const BLOCK_DROPS: Partial<Record<BlockType, ItemType>> = {
  stone: 'cobblestone',
  coal_ore: 'coal',
  iron_ore: 'iron_ingot',
  copper_ore: 'copper_ingot',
  gold_ore: 'gold_ingot',
  lapis_ore: 'lapis',
  diamond_ore: 'diamond',
  obsidian: 'obsidian',
  wood: 'wood',
  cobblestone: 'cobblestone',
  planks: 'planks',
};

export const ITEM_CONFIG: Record<ItemType, { label: string; emoji: string; color: string }> = {
  wood: { label: 'Madeira', emoji: '🪵', color: '#5a3a1a' },
  stone: { label: 'Pedra', emoji: '🪨', color: '#8a8a8a' },
  cobblestone: { label: 'Pedregulho', emoji: '🧱', color: '#6a6a6a' },
  planks: { label: 'Tábuas', emoji: '🟫', color: '#b8944a' },
  coal: { label: 'Carvão', emoji: '⚫', color: '#2a2a2a' },
  iron_ingot: { label: 'Ferro', emoji: '🔩', color: '#c4c4c4' },
  copper_ingot: { label: 'Cobre', emoji: '🟤', color: '#b87333' },
  gold_ingot: { label: 'Ouro', emoji: '🥇', color: '#ffd700' },
  lapis: { label: 'Lapis Lazuli', emoji: '🔵', color: '#1a3a8a' },
  diamond: { label: 'Diamante', emoji: '💎', color: '#4ae0e0' },
  obsidian: { label: 'Obsidiana', emoji: '⬛', color: '#1a0a2a' },
  stick: { label: 'Graveto', emoji: '🥢', color: '#8a6a3a' },
  wood_sword: { label: 'Espada de Madeira', emoji: '🗡️', color: '#8a6a3a' },
  stone_sword: { label: 'Espada de Pedra', emoji: '🗡️', color: '#8a8a8a' },
  iron_sword: { label: 'Espada de Ferro', emoji: '⚔️', color: '#c4c4c4' },
  diamond_sword: { label: 'Espada de Diamante', emoji: '⚔️', color: '#4ae0e0' },
  wood_pickaxe: { label: 'Picareta de Madeira', emoji: '⛏️', color: '#8a6a3a' },
  stone_pickaxe: { label: 'Picareta de Pedra', emoji: '⛏️', color: '#8a8a8a' },
  iron_pickaxe: { label: 'Picareta de Ferro', emoji: '⛏️', color: '#c4c4c4' },
  diamond_pickaxe: { label: 'Picareta de Diamante', emoji: '⛏️', color: '#4ae0e0' },
  wood_axe: { label: 'Machado de Madeira', emoji: '🪓', color: '#8a6a3a' },
  stone_axe: { label: 'Machado de Pedra', emoji: '🪓', color: '#8a8a8a' },
  iron_axe: { label: 'Machado de Ferro', emoji: '🪓', color: '#c4c4c4' },
  diamond_axe: { label: 'Machado de Diamante', emoji: '🪓', color: '#4ae0e0' },
  shield: { label: 'Escudo', emoji: '🛡️', color: '#5a3a1a' },
  lance: { label: 'Lança', emoji: '🔱', color: '#c4c4c4' },
  torch: { label: 'Tocha', emoji: '🔥', color: '#ffa500' },
  door: { label: 'Porta', emoji: '🚪', color: '#8a6a3a' },
  crafting_table: { label: 'Mesa de Craft', emoji: '🔨', color: '#8a6a2a' },
};

export const CRAFT_RECIPES: CraftRecipe[] = [
  // Basic
  { result: 'planks', resultCount: 4, ingredients: { wood: 1 }, label: 'Tábuas', category: 'block' },
  { result: 'stick', resultCount: 4, ingredients: { planks: 2 }, label: 'Gravetos', category: 'misc' },
  { result: 'crafting_table', resultCount: 1, ingredients: { planks: 4 }, label: 'Mesa de Craft', category: 'block' },
  { result: 'torch', resultCount: 4, ingredients: { stick: 1, coal: 1 }, label: 'Tochas', category: 'misc' },
  { result: 'door', resultCount: 1, ingredients: { planks: 6 }, label: 'Porta', category: 'block' },

  // Wood tools
  { result: 'wood_sword', resultCount: 1, ingredients: { planks: 2, stick: 1 }, label: 'Espada de Madeira', category: 'weapon' },
  { result: 'wood_pickaxe', resultCount: 1, ingredients: { planks: 3, stick: 2 }, label: 'Picareta de Madeira', category: 'tool' },
  { result: 'wood_axe', resultCount: 1, ingredients: { planks: 3, stick: 2 }, label: 'Machado de Madeira', category: 'tool' },

  // Stone tools
  { result: 'stone_sword', resultCount: 1, ingredients: { cobblestone: 2, stick: 1 }, label: 'Espada de Pedra', category: 'weapon' },
  { result: 'stone_pickaxe', resultCount: 1, ingredients: { cobblestone: 3, stick: 2 }, label: 'Picareta de Pedra', category: 'tool' },
  { result: 'stone_axe', resultCount: 1, ingredients: { cobblestone: 3, stick: 2 }, label: 'Machado de Pedra', category: 'tool' },

  // Iron tools
  { result: 'iron_sword', resultCount: 1, ingredients: { iron_ingot: 2, stick: 1 }, label: 'Espada de Ferro', category: 'weapon' },
  { result: 'iron_pickaxe', resultCount: 1, ingredients: { iron_ingot: 3, stick: 2 }, label: 'Picareta de Ferro', category: 'tool' },
  { result: 'iron_axe', resultCount: 1, ingredients: { iron_ingot: 3, stick: 2 }, label: 'Machado de Ferro', category: 'tool' },

  // Diamond tools
  { result: 'diamond_sword', resultCount: 1, ingredients: { diamond: 2, stick: 1 }, label: 'Espada de Diamante', category: 'weapon' },
  { result: 'diamond_pickaxe', resultCount: 1, ingredients: { diamond: 3, stick: 2 }, label: 'Picareta de Diamante', category: 'tool' },
  { result: 'diamond_axe', resultCount: 1, ingredients: { diamond: 3, stick: 2 }, label: 'Machado de Diamante', category: 'tool' },

  // Special
  { result: 'shield', resultCount: 1, ingredients: { iron_ingot: 1, planks: 6 }, label: 'Escudo', category: 'weapon' },
  { result: 'lance', resultCount: 1, ingredients: { iron_ingot: 2, stick: 3 }, label: 'Lança', category: 'weapon' },
];

export const TOOL_DAMAGE: Partial<Record<ItemType, number>> = {
  wood_sword: 5, stone_sword: 7, iron_sword: 10, diamond_sword: 15,
  wood_axe: 6, stone_axe: 8, iron_axe: 11, diamond_axe: 14,
  lance: 12, shield: 2,
};

export const TOOL_MINING_SPEED: Partial<Record<ItemType, number>> = {
  wood_pickaxe: 1.5, stone_pickaxe: 2, iron_pickaxe: 3, diamond_pickaxe: 5,
  wood_axe: 1.5, stone_axe: 2, iron_axe: 3, diamond_axe: 5,
};

// Which pickaxe tier is needed for certain ores
export const MINING_REQUIREMENTS: Partial<Record<BlockType, ItemType[]>> = {
  iron_ore: ['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'],
  gold_ore: ['iron_pickaxe', 'diamond_pickaxe'],
  diamond_ore: ['iron_pickaxe', 'diamond_pickaxe'],
  obsidian: ['diamond_pickaxe'],
  lapis_ore: ['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe'],
};

export const FRUIT_CONFIG: Record<FruitType, { color: string; emissive: string; name: string; power: string }> = {
  flame: { color: '#FF4500', emissive: '#FF2200', name: 'Mera Mera', power: '🔥 Fogo' },
  ice: { color: '#00BCD4', emissive: '#006688', name: 'Hie Hie', power: '❄️ Gelo' },
  light: { color: '#FFD700', emissive: '#CC9900', name: 'Pika Pika', power: '⚡ Luz' },
  dark: { color: '#8B00FF', emissive: '#4400AA', name: 'Yami Yami', power: '🌑 Trevas' },
  rubber: { color: '#FF69B4', emissive: '#CC3366', name: 'Gomu Gomu', power: '🩷 Borracha' },
};
