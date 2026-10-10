import { World } from './world';
import { ItemType } from './types';
import { WORLD_HALF, WATER_LEVEL } from './biomes';

export type MobType = 'zombie' | 'skeleton' | 'spider' | 'cow' | 'pig' | 'chicken' | 'sheep' | 'villager' | 'guardian';

export interface MobData {
  id: string;
  type: MobType;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  hostile: boolean;
  speed: number;
  dead: boolean;
  /** Guardião: a fruta que ele protege e o lugar de onde não se afasta. */
  guardsFruit?: string;
  home?: [number, number, number];
}

export const MOB_CONFIG: Record<MobType, {
  color: string;
  eyeColor: string;
  health: number;
  speed: number;
  hostile: boolean;
  bodyScale: [number, number, number];
  label: string;
}> = {
  zombie: { color: '#4a7a3a', eyeColor: '#ff0000', health: 20, speed: 2, hostile: true, bodyScale: [0.5, 1.2, 0.35], label: '🧟 Zumbi' },
  skeleton: { color: '#d4cfc4', eyeColor: '#1a1a1a', health: 15, speed: 2.5, hostile: true, bodyScale: [0.4, 1.3, 0.3], label: '💀 Esqueleto' },
  spider: { color: '#3a2a2a', eyeColor: '#ff0000', health: 12, speed: 3.5, hostile: true, bodyScale: [0.8, 0.35, 0.6], label: '🕷️ Aranha' },
  cow: { color: '#8B6914', eyeColor: '#222222', health: 20, speed: 1.2, hostile: false, bodyScale: [0.7, 0.8, 0.5], label: '🐄 Vaca' },
  pig: { color: '#e8a0a0', eyeColor: '#222222', health: 16, speed: 1.5, hostile: false, bodyScale: [0.6, 0.55, 0.45], label: '🐷 Porco' },
  chicken: { color: '#f0f0f0', eyeColor: '#222222', health: 8, speed: 1.8, hostile: false, bodyScale: [0.3, 0.4, 0.3], label: '🐔 Galinha' },
  sheep: { color: '#eeeeea', eyeColor: '#222222', health: 16, speed: 1.3, hostile: false, bodyScale: [0.8, 1.45, 1.05], label: '🐑 Ovelha' },
  villager: { color: '#c4956a', eyeColor: '#5a3a1a', health: 20, speed: 1, hostile: false, bodyScale: [0.5, 1.1, 0.35], label: '👤 Aldeão' },
  guardian: { color: '#4b2d7a', eyeColor: '#ffcc00', health: 90, speed: 2.6, hostile: true, bodyScale: [0.8, 1.6, 0.5], label: '🛡️ Guardião' },
};

export function spawnMobs(world: World, isNight: boolean): MobData[] {
  const mobs: MobData[] = [];
  const half = WORLD_HALF - 3;

  // Animals & villagers always
  const passiveTypes: MobType[] = ['cow', 'pig', 'sheep', 'chicken', 'cow', 'sheep', 'pig', 'villager'];
  for (let i = 0; i < 56; i++) {
    const type = passiveTypes[i % passiveTypes.length];
    const config = MOB_CONFIG[type];
    const x = (Math.random() - 0.5) * half * 2;
    const z = (Math.random() - 0.5) * half * 2;
    const groundY = world.groundHeight(x, z);
    if (groundY <= WATER_LEVEL) continue; // não nasce na água
    mobs.push({
      id: `mob-passive-${i}`,
      type,
      position: [x, groundY + config.bodyScale[1] / 2, z],
      health: config.health,
      maxHealth: config.health,
      hostile: false,
      speed: config.speed,
      dead: false,
    });
  }

  // Monsters only at night
  if (isNight) {
    const hostileTypes: MobType[] = ['zombie', 'skeleton', 'spider'];
    for (let i = 0; i < 34; i++) {
      const type = hostileTypes[i % hostileTypes.length];
      const config = MOB_CONFIG[type];
      const x = (Math.random() - 0.5) * half * 2;
      const z = (Math.random() - 0.5) * half * 2;
      const groundY = world.groundHeight(x, z);
      if (groundY <= WATER_LEVEL) continue;
      mobs.push({
        id: `mob-hostile-${i}`,
        type,
        position: [x, groundY + config.bodyScale[1] / 2, z],
        health: config.health,
        maxHealth: config.health,
        hostile: true,
        speed: config.speed,
        dead: false,
      });
    }
  }

  return mobs;
}

/** Um Guardião (mini-chefe) para cada fruta. Ele não deixa pegar a fruta enquanto estiver vivo. */
export function spawnGuardians(fruits: { id: string; position: [number, number, number] }[]): MobData[] {
  const config = MOB_CONFIG.guardian;
  return fruits.map((f, i) => {
    const angle = i * 2.1;
    const x = f.position[0] + Math.cos(angle) * 2.5;
    const z = f.position[2] + Math.sin(angle) * 2.5;
    const y = f.position[1] - 1.5;
    return {
      id: `guardian-${f.id}`,
      type: 'guardian' as MobType,
      position: [x, y + config.bodyScale[1] / 2, z] as [number, number, number],
      health: config.health,
      maxHealth: config.health,
      hostile: true,
      speed: config.speed,
      dead: false,
      guardsFruit: f.id,
      home: [f.position[0], y, f.position[2]] as [number, number, number],
    };
  });
}

/** Comida que cada animal deixa ao morrer: [item, quantidade mínima, máxima]. */
export const ANIMAL_FOOD: Partial<Record<MobType, [ItemType, number, number]>> = {
  cow: ['beef', 1, 3],
  pig: ['porkchop', 1, 3],
  sheep: ['mutton', 1, 2],
  chicken: ['chicken_meat', 1, 2],
};
