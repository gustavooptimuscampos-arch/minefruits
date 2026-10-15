import { describe, it, expect, beforeEach } from 'vitest';
import { buildBiomeLayout } from '@/components/game/biomes';
import { generateTerrain, generateFruits } from '@/components/game/terrainGenerator';
import { GameSave, loadLocalSave, newest, saveLocal } from '@/components/game/save';

const makeWorld = (seed: number) => {
  const layout = buildBiomeLayout(seed);
  const world = generateTerrain(layout);
  generateFruits(world, seed, layout);
  return world;
};

describe('salvar o progresso', () => {
  beforeEach(() => localStorage.clear());

  it('o mundo volta igual: blocos quebrados e colocados', () => {
    const a = makeWorld(77);
    const g = a.groundHeight(5, 5);
    a.edit(5, g - 1, 5, null);          // quebrou o chão
    a.edit(6, g + 3, 6, 'wood');         // colocou madeira no ar
    a.edit(-60, 1, 60, null);            // cavou no canto do mapa
    const saved = JSON.parse(JSON.stringify(a.exportEdits()));

    const b = makeWorld(77);             // mesma semente = mesmo mapa inicial
    expect(b.get(5, g - 1, 5)).toBeTruthy();
    b.importEdits(saved);
    expect(b.get(5, g - 1, 5)).toBeUndefined();
    expect(b.get(6, g + 3, 6)).toBe('wood');
    expect(b.get(-60, 1, 60)).toBeUndefined();
    expect(b.groundHeight(5, 5)).toBe(a.groundHeight(5, 5));
    expect(b.editCount).toBe(3);
  });

  it('bloco que não existe mais no jogo é ignorado (não quebra o carregamento)', () => {
    const w = makeWorld(3);
    w.importEdits([[1, 50, 1, 'bloco_antigo'], [2, 50, 2, 'stone']]);
    expect(w.get(1, 50, 1)).toBeUndefined();
    expect(w.get(2, 50, 2)).toBe('stone');
  });

  it('guarda e lê do aparelho; o mais novo vence', () => {
    const save: GameSave = {
      v: 1, savedAt: 1000,
      personal: { voxelCoins: 42, ownedItems: ['hat_crown'], equippedItems: { hat: 'hat_crown' } },
      world: null,
    };
    expect(saveLocal('p1', save)).toBe(true);
    expect(loadLocalSave('p1')?.personal.voxelCoins).toBe(42);
    expect(loadLocalSave('outro')).toBeNull();
    const cloud = { ...save, savedAt: 2000, personal: { ...save.personal, voxelCoins: 99 } };
    expect(newest(loadLocalSave('p1'), cloud)?.personal.voxelCoins).toBe(99);
    expect(newest(null, null)).toBeNull();
  });

  it('salvamento estragado não derruba o jogo', () => {
    localStorage.setItem('minefruits:save:p2', '{quebrado');
    expect(loadLocalSave('p2')).toBeNull();
  });
});
