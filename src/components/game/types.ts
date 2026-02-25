export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'leaves' | 'sand' | 'water' | 'snow' | 'flower';

export type FruitType = 'flame' | 'ice' | 'light' | 'dark' | 'rubber';

export interface Fruit {
  id: string;
  position: [number, number, number];
  type: FruitType;
  collected: boolean;
}

export const BLOCK_COLORS: Record<BlockType, string> = {
  grass: '#4a8c3f',
  dirt: '#8B6914',
  stone: '#707070',
  wood: '#6B4226',
  leaves: '#2E7D32',
  sand: '#D4B96A',
  water: '#1E90FF',
  snow: '#F0F0F0',
  flower: '#FF6B9D',
};

export const FRUIT_CONFIG: Record<FruitType, { color: string; emissive: string; name: string; power: string }> = {
  flame: { color: '#FF4500', emissive: '#FF2200', name: 'Mera Mera', power: '🔥 Fogo' },
  ice: { color: '#00BCD4', emissive: '#006688', name: 'Hie Hie', power: '❄️ Gelo' },
  light: { color: '#FFD700', emissive: '#CC9900', name: 'Pika Pika', power: '⚡ Luz' },
  dark: { color: '#8B00FF', emissive: '#4400AA', name: 'Yami Yami', power: '🌑 Trevas' },
  rubber: { color: '#FF69B4', emissive: '#CC3366', name: 'Gomu Gomu', power: '🩷 Borracha' },
};
