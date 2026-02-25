export interface SkinData {
  id: string;
  name: string;
  // Body colors
  head: string;
  body: string;
  arms: string;
  legs: string;
  // Accessories
  eyes: string;
  hat?: string;
  cape?: string;
  // Label
  label: string;
}

export const SKINS: SkinData[] = [
  {
    id: 'steve',
    name: 'Steve',
    head: '#c4956a',
    body: '#00a2e8',
    arms: '#c4956a',
    legs: '#3f48cc',
    eyes: '#3a2a1a',
    label: '⛏️ Steve',
  },
  {
    id: 'luffy',
    name: 'Luffy',
    head: '#d4a574',
    body: '#cc0000',
    arms: '#d4a574',
    legs: '#3344aa',
    eyes: '#1a1a1a',
    hat: '#cc8800',
    label: '🏴‍☠️ Luffy',
  },
  {
    id: 'zoro',
    name: 'Zoro',
    head: '#d4a574',
    body: '#2d5a27',
    arms: '#d4a574',
    legs: '#1a1a1a',
    eyes: '#2a3a1a',
    label: '⚔️ Zoro',
  },
  {
    id: 'ace',
    name: 'Ace',
    head: '#c48a5a',
    body: '#ff6600',
    arms: '#c48a5a',
    legs: '#2a2a2a',
    eyes: '#1a1a1a',
    hat: '#ff6600',
    label: '🔥 Ace',
  },
  {
    id: 'enderman',
    name: 'Enderman',
    head: '#1a1a2a',
    body: '#1a1a2a',
    arms: '#1a1a2a',
    legs: '#1a1a2a',
    eyes: '#cc00ff',
    label: '👾 Enderman',
  },
  {
    id: 'creeper',
    name: 'Creeper',
    head: '#3a8a3a',
    body: '#3a8a3a',
    arms: '#3a8a3a',
    legs: '#3a8a3a',
    eyes: '#1a1a1a',
    label: '💥 Creeper',
  },
  {
    id: 'shanks',
    name: 'Shanks',
    head: '#d4a574',
    body: '#1a1a1a',
    arms: '#d4a574',
    legs: '#4a3a2a',
    eyes: '#3a1a1a',
    hat: '#cc0000',
    cape: '#cc0000',
    label: '🗡️ Shanks',
  },
  {
    id: 'alex',
    name: 'Alex',
    head: '#d4a574',
    body: '#5a9a4a',
    arms: '#d4a574',
    legs: '#6a4a2a',
    eyes: '#2a5a2a',
    label: '🏗️ Alex',
  },
];
