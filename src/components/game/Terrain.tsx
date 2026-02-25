import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from './types';

interface TerrainProps {
  blocks: Record<string, BlockType>;
}

const MAX_BLOCKS = 15000;

// Separate water blocks for transparency
function separateBlocks(blocks: Record<string, BlockType>) {
  const solid: { position: THREE.Vector3; type: BlockType }[] = [];
  const water: { position: THREE.Vector3 }[] = [];

  Object.entries(blocks).forEach(([key, type]) => {
    const [x, y, z] = key.split(',').map(Number);
    const pos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    if (type === 'water') {
      water.push({ position: pos });
    } else {
      // Add slight color variation for realism
      solid.push({ position: pos, type });
    }
  });

  return { solid, water };
}

export function Terrain({ blocks }: TerrainProps) {
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);

  const { solid, water } = useMemo(() => separateBlocks(blocks), [blocks]);

  // Update solid blocks
  useEffect(() => {
    if (!solidRef.current) return;
    const mesh = solidRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    mesh.count = solid.length;

    solid.forEach((block, i) => {
      dummy.position.copy(block.position);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Add natural color variation per block
      const baseColor = BLOCK_COLORS[block.type] || '#808080';
      color.set(baseColor);
      const variation = (Math.sin(block.position.x * 13.7 + block.position.z * 7.3) * 0.5 + 0.5) * 0.08 - 0.04;
      color.r = Math.max(0, Math.min(1, color.r + variation));
      color.g = Math.max(0, Math.min(1, color.g + variation * 0.8));
      color.b = Math.max(0, Math.min(1, color.b + variation * 0.6));
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [solid]);

  // Update water blocks
  useEffect(() => {
    if (!waterRef.current || water.length === 0) return;
    const mesh = waterRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color('#2196F3');

    mesh.count = water.length;

    water.forEach((block, i) => {
      dummy.position.copy(block.position);
      dummy.position.y -= 0.15; // Slightly lower water surface
      dummy.scale.set(1, 0.7, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [water]);

  return (
    <>
      {/* Solid terrain */}
      <instancedMesh ref={solidRef} args={[undefined, undefined, MAX_BLOCKS]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
      </instancedMesh>

      {/* Water - transparent */}
      {water.length > 0 && (
        <instancedMesh ref={waterRef} args={[undefined, undefined, water.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            vertexColors
            transparent
            opacity={0.55}
            roughness={0.1}
            metalness={0.3}
            color="#2196F3"
          />
        </instancedMesh>
      )}
    </>
  );
}
