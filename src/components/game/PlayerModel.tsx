import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SkinData } from './skins';

interface PlayerModelProps {
  skin: SkinData;
  position: THREE.Vector3;
  rotation: number; // Y rotation
  isMoving: boolean;
  isThirdPerson: boolean;
}

export function PlayerModel({ skin, position, rotation, isMoving, isThirdPerson }: PlayerModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const walkPhase = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(position);
    groupRef.current.position.y -= 1.7; // Offset from camera to feet
    groupRef.current.rotation.y = rotation + Math.PI; // Face forward

    // Walk animation
    if (isMoving) {
      walkPhase.current += delta * 8;
    } else {
      walkPhase.current *= 0.9;
    }
    const swing = Math.sin(walkPhase.current) * 0.6;

    if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
  });

  if (!isThirdPerson) {
    // First person: only show arms
    return (
      <group ref={groupRef}>
        {/* Right arm (visible in first person) */}
        <mesh position={[0.45, 0.8, -0.5]} rotation={[-0.8, 0, 0]}>
          <boxGeometry args={[0.25, 0.7, 0.25]} />
          <meshStandardMaterial color={skin.arms} roughness={0.7} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color={skin.head} roughness={0.7} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.1, 1.52, -0.26]}>
        <boxGeometry args={[0.08, 0.06, 0.02]} />
        <meshStandardMaterial color={skin.eyes} />
      </mesh>
      <mesh position={[-0.1, 1.52, -0.26]}>
        <boxGeometry args={[0.08, 0.06, 0.02]} />
        <meshStandardMaterial color={skin.eyes} />
      </mesh>

      {/* Hat */}
      {skin.hat && (
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[0.55, 0.15, 0.55]} />
          <meshStandardMaterial color={skin.hat} roughness={0.6} />
        </mesh>
      )}

      {/* Body */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.5, 0.65, 0.3]} />
        <meshStandardMaterial color={skin.body} roughness={0.7} />
      </mesh>

      {/* Cape */}
      {skin.cape && (
        <mesh position={[0, 1.0, 0.18]} castShadow>
          <boxGeometry args={[0.48, 0.6, 0.05]} />
          <meshStandardMaterial color={skin.cape} roughness={0.6} />
        </mesh>
      )}

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[0.38, 0.95, 0]} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.25]} />
        <meshStandardMaterial color={skin.arms} roughness={0.7} />
      </mesh>

      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[-0.38, 0.95, 0]} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.25]} />
        <meshStandardMaterial color={skin.arms} roughness={0.7} />
      </mesh>

      {/* Left Leg */}
      <mesh ref={leftLegRef} position={[0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.22, 0.6, 0.25]} />
        <meshStandardMaterial color={skin.legs} roughness={0.7} />
      </mesh>

      {/* Right Leg */}
      <mesh ref={rightLegRef} position={[-0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.22, 0.6, 0.25]} />
        <meshStandardMaterial color={skin.legs} roughness={0.7} />
      </mesh>

      {/* Shadow circle on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
