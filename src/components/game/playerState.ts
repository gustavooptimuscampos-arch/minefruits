import * as THREE from 'three';

/**
 * Posição real do jogador (pés + altura dos olhos), atualizada pelo Player a cada frame.
 * Mobs e o cachorro usam isto em vez da câmera: em terceira pessoa a câmera fica
 * atrás do jogador, e eles acabavam perseguindo/atacando a câmera.
 */
export const playerPosition = new THREE.Vector3(0, 8, 0);

/**
 * Posições vivas dos mobs (usado pelo cachorro e pelos golpes).
 * centerY: quanto subir a partir de "pos" para chegar no meio do corpo
 * (os animais têm a posição nos pés).
 */
export const mobRegistry = new Map<string, { pos: THREE.Vector3; hostile: boolean; centerY: number; radius: number }>();

/** Para onde o jogador está olhando (atualizado pelo Player a cada frame). */
export const playerLook = new THREE.Vector3(0, 0, -1);

/** Efeitos de poder nos mobs: até quando cada um fica congelado (ms). */
export const mobFrozenUntil = new Map<string, number>();

/** Pedidos dos poderes para o Player executar no próximo frame. */
export const playerCommands: { dash: THREE.Vector3 | null } = { dash: null };

/** Efeitos visuais dos poderes em andamento (desenhados pelo PowerEffects). */
export interface PowerEffect {
  id: number;
  kind: 'flame' | 'ice' | 'light' | 'dark' | 'rubber';
  pos: THREE.Vector3;
  start: number;
  radius: number;
}
export const powerEffects: PowerEffect[] = [];
let effectId = 0;
export function addPowerEffect(kind: PowerEffect['kind'], pos: THREE.Vector3, radius: number) {
  powerEffects.push({ id: effectId++, kind, pos: pos.clone(), start: performance.now(), radius });
}
