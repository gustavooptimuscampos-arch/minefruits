import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fruit, FRUIT_CONFIG } from './types';

interface FruitsProps {
  fruits: Fruit[];
}

export function Fruits({ fruits }: FruitsProps) {
  return (
    <>
      {fruits.filter(f => !f.collected).map(fruit => (
        <FruitMesh key={fruit.id} fruit={fruit} />
      ))}
    </>
  );
}

function FruitMesh({ fruit }: { fruit: Fruit }) {
  const ref = useRef<THREE.Mesh>(null);
  const baseY = fruit.position[1];
  const config = FRUIT_CONFIG[fruit.type];

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.02;
      ref.current.position.y = baseY + Math.sin(Date.now() * 0.003) * 0.3;
    }
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
      {/* Glow */}
      <pointLight
        position={[fruit.position[0], baseY, fruit.position[2]]}
        color={config.color}
        intensity={1}
        distance={4}
      />
    </group>
  );
}
