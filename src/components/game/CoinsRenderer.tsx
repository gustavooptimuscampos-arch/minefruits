import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameCoin } from './types';

interface CoinsRendererProps {
  coins: GameCoin[];
}

export function CoinsRenderer({ coins }: CoinsRendererProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      child.rotation.y = t * 2 + i;
      child.position.y = (child.userData.baseY || 0) + Math.sin(t * 3 + i) * 0.15;
    });
  });

  const visibleCoins = useMemo(() => coins.filter(c => !c.collected), [coins]);

  return (
    <group ref={groupRef}>
      {visibleCoins.map(coin => (
        <group key={coin.id} position={coin.position} userData={{ baseY: coin.position[1] }}>
          {/* Coin body */}
          <mesh castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.06, 16]} />
            <meshStandardMaterial
              color="#ffd700"
              emissive="#cc9900"
              emissiveIntensity={0.5}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          {/* Brilho (halo sem luz dinâmica) */}
          <mesh>
            <sphereGeometry args={[0.4, 10, 10]} />
            <meshBasicMaterial color="#ffd700" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
