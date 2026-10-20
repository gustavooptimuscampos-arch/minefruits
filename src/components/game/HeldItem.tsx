import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemType } from './types';
import { ItemModel } from './ItemModel';
import { isTool } from './itemKinds';
import { handState } from './playerState';
import { lightState } from './lightState';

/**
 * Mão do jogador em primeira pessoa, com o item que ele está segurando.
 * É desenhada numa "camada" separada, por cima do mundo: assim a ferramenta nunca
 * atravessa a parede quando o jogador encosta nela.
 * Balança ao andar, faz o movimento de golpe ao bater/colocar e "sobe" ao trocar de item.
 */
export function HeldItem({ item, armColor }: { item: ItemType | null; armColor: string }) {
  const { gl, scene, camera } = useThree();
  const handScene = useMemo(() => new THREE.Scene(), []);
  const root = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const bob = useRef(0);
  const equipAt = useRef(0);
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({ color: armColor, roughness: 0.75 }), [armColor]);
  useEffect(() => () => armMat.dispose(), [armMat]);

  // Trocou de item: a mão desce e sobe de novo
  useEffect(() => { equipAt.current = performance.now(); }, [item]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now();
    const visible = !handState.thirdPerson;

    if (root.current && hand.current && visible) {
      root.current.position.copy(camera.position);
      root.current.quaternion.copy(camera.quaternion);

      // balanço do passo
      bob.current += dt * 9 * handState.walk * (handState.onGround ? 1 : 0.2);
      const w = handState.walk;
      const bx = Math.sin(bob.current) * 0.018 * w;
      const by = -Math.abs(Math.cos(bob.current)) * 0.022 * w;
      // golpe: o braço desce para a frente e volta
      const k = Math.min(1, (now - handState.swingAt) / 260);
      const swing = k < 1 ? Math.sin(k * Math.PI) : 0;
      // troca de item
      const e = Math.min(1, (now - equipAt.current) / 220);
      const equipDrop = (1 - e) * 0.35;

      hand.current.position.set(0.4 + bx, -0.4 + by - equipDrop - swing * 0.05, -0.62 - swing * 0.12);
      hand.current.rotation.set(-swing * 1.1, -swing * 0.25, swing * 0.35);
    }

    // Luz da mão acompanha a do mundo (de noite a mão fica escura também)
    const day = lightState.dayFactor;
    if (sun.current) { sun.current.intensity = 0.6 + day * 1.6; sun.current.color.copy(lightState.tint); }
    if (amb.current) amb.current.intensity = 0.45 + day * 0.55;

    // Desenha o mundo e, por cima (limpando só a profundidade), a mão
    gl.autoClear = true;
    gl.render(scene, camera);
    if (visible) {
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(handScene, camera);
      gl.autoClear = true;
    }
  }, 1);

  const tool = item ? isTool(item) : false;

  return createPortal(
    <>
      <ambientLight ref={amb} intensity={0.8} />
      <directionalLight ref={sun} position={[0.5, 1, 0.4]} intensity={1.6} />
      <group ref={root}>
        <group ref={hand}>
          {/* braço (cor da skin), vindo do canto de baixo da tela */}
          <mesh material={armMat} position={[0.05, -0.1, 0.16]} rotation={[-1.2, 0.2, 0.15]} scale={[0.12, 0.42, 0.12]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {item && (
            tool ? (
              // ferramenta em pé na mão, com a cabeça para a frente
              <group position={[-0.01, 0.0, -0.06]} rotation={[-0.5, -0.4, 0.2]} scale={0.42}>
                <ItemModel item={item} />
              </group>
            ) : (
              // bloco, comida, minério: na palma da mão
              <group position={[-0.03, -0.02, -0.08]} rotation={[0.2, -0.55, 0.05]} scale={0.5}>
                <ItemModel item={item} />
              </group>
            )
          )}
        </group>
      </group>
    </>,
    handScene,
  );
}
