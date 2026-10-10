import * as THREE from 'three';

/**
 * Posição real do jogador (pés + altura dos olhos), atualizada pelo Player a cada frame.
 * Mobs e o cachorro usam isto em vez da câmera: em terceira pessoa a câmera fica
 * atrás do jogador, e eles acabavam perseguindo/atacando a câmera.
 */
export const playerPosition = new THREE.Vector3(0, 8, 0);

/** Posições vivas dos mobs (usado pelo cachorro). */
export const mobRegistry = new Map<string, { pos: THREE.Vector3; hostile: boolean }>();
