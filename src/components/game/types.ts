export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'water' | 'snow' | 'flower';

export type FruitType = 'flame' | 'ice' | 'light' | 'dark' | 'rubber';

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
};

export const FRUIT_CONFIG: Record<FruitType, { color: string; emissive: string; name: string; power: string }> = {
  flame: { color: '#FF4500', emissive: '#FF2200', name: 'Mera Mera', power: '🔥 Fogo' },
  ice: { color: '#00BCD4', emissive: '#006688', name: 'Hie Hie', power: '❄️ Gelo' },
  light: { color: '#FFD700', emissive: '#CC9900', name: 'Pika Pika', power: '⚡ Luz' },
  dark: { color: '#8B00FF', emissive: '#4400AA', name: 'Yami Yami', power: '🌑 Trevas' },
  rubber: { color: '#FF69B4', emissive: '#CC3366', name: 'Gomu Gomu', power: '🩷 Borracha' },
};
