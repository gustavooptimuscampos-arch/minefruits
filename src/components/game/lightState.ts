import * as THREE from 'three';

// Shared world-lighting state, written by DayNightCycle and read by
// baked-lighting meshes (terrain) so they can tint with the sky.
export const lightState = {
  tint: new THREE.Color(1, 1, 1),
  sky: new THREE.Color('#87CEEB'),
  sunElevation: 1,
  dayFactor: 1,
};
