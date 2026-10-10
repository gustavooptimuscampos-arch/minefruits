import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fruit, FRUIT_CONFIG } from './types';

interface FruitsProps {
  fruits: Fruit[];
  /** Frutas ainda protegidas pelo Guardião (aparecem dentro de um escudo). */
  lockedIds?: Set<string>;
}

export function Fruits({ fruits, lockedIds }: FruitsProps) {
  return (
    <>
      {fruits.filter(f => !f.collected).map(fruit => (
        <FruitMesh key={fruit.id} fruit={fruit} locked={!!lockedIds?.has(fruit.id)} />
      ))}
    </>
  );
}

function FruitMesh({ fruit, locked }: { fruit: Fruit; locked: boolean }) {
  const shieldRef = useRef<THREE.Mesh>(null);
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const baseY = fruit.position[1];
  const config = FRUIT_CONFIG[fruit.type];

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.02;
      ref.current.position.y = baseY + Math.sin(Date.now() * 0.003) * 0.3;
    }
    if (haloRef.current && ref.current) haloRef.current.position.y = ref.current.position.y;
    if (shieldRef.current) shieldRef.current.rotation.y += 0.01;
  });

  return (
    <group>
      <mesh ref={ref} position={[fruit.position[0], baseY, fruit.position[2]]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Brilho (halo sem luz dinâmica: luzes por item travavam o jogo a cada coleta) */}
      <mesh ref={haloRef} position={[fruit.position[0], baseY, fruit.position[2]]}>
        <sphereGeometry args={[0.6, 12, 12]} />
        <meshBasicMaterial color={config.color} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Escudo do Guardião: some quando ele é derrotado */}
      {locked && (
        <mesh ref={shieldRef} position={[fruit.position[0], baseY, fruit.position[2]]}>
          <icosahedronGeometry args={[1.1, 1]} />
          <meshBasicMaterial color="#ffcc00" wireframe transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}
