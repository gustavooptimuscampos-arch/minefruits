import { MobType } from './mobs';
import { FruitType } from './types';

// Points awarded per mob kill
export const MOB_POINTS: Record<MobType, number> = {
  zombie: 50,
  skeleton: 60,
  spider: 40,
  cow: 10,
  pig: 10,
  chicken: 5,
  sheep: 10,
  villager: 0,
};

// Points awarded per fruit collected
export const FRUIT_POINTS: Record<FruitType, number> = {
  flame: 200,
  ice: 150,
  light: 250,
  dark: 300,
  rubber: 100,
};

// Hunger restored per fruit
export const FRUIT_HUNGER: Record<FruitType, number> = {
  flame: 25,
  ice: 20,
  light: 30,
  dark: 15,
  rubber: 20,
};

export interface ScoreEntry {
  type: 'mob' | 'fruit';
  name: string;
  emoji: string;
  points: number;
  count: number;
}
