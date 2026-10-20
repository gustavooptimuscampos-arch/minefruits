import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Liga "projeta sombra" em tudo o que é iluminado (jogador, animais, monstros, cachorro...).
 * Confere a cena de vez em quando, porque os bichos nascem e somem durante o jogo.
 * Coisas que brilham (MeshBasic), a água e o céu ficam de fora.
 */
export function ShadowFlags({ enabled }: { enabled: boolean }) {
  const { scene, gl } = useThree();
  const last = useRef(-10);
  // Trocar a qualidade no meio do jogo: liga/desliga as sombras e recompila os materiais
  useEffect(() => {
    gl.shadowMap.enabled = enabled;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.needsUpdate = true;
    scene.traverse(obj => {
      const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => (m.needsUpdate = true));
      else if (mat) mat.needsUpdate = true;
    });
    last.current = -10;
  }, [enabled, gl, scene]);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 1) return;
    last.current = clock.elapsedTime;
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.terrain) return;
      const mat = mesh.material as THREE.Material;
      const lit = !!mat && !Array.isArray(mat) && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial
        || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial || (mat as THREE.MeshPhongMaterial).isMeshPhongMaterial;
      const casts = enabled && lit && !mat.transparent;
      if (mesh.castShadow !== casts) mesh.castShadow = casts;
    });
  });
  return null;
}
