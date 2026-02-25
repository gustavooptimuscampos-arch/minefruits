import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from './types';

interface TerrainProps {
  blocks: Record<string, BlockType>;
}

const MAX_BLOCKS = 15000;

export function Terrain({ blocks }: TerrainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const blockArray = useMemo(() =>
    Object.entries(blocks).map(([key, type]) => {
      const [x, y, z] = key.split(',').map(Number);
      return { position: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), type };
    }),
    [blocks]
  );

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    mesh.count = blockArray.length;

    blockArray.forEach((block, i) => {
      dummy.position.copy(block.position);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(BLOCK_COLORS[block.type] || '#808080');
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blockArray]);

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_BLOCKS]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial vertexColors />
      </instancedMesh>
    </>
  );
}
