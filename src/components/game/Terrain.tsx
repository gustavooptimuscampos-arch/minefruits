import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockType, BLOCK_COLORS } from './types';

interface TerrainProps {
  blocks: Record<string, BlockType>;
}

type Vec3 = [number, number, number];

interface FaceDef {
  n: Vec3;
  u: Vec3;
  v: Vec3;
  shade: number;
}

// (u, v, n) form a right-handed basis so winding is always correct
const FACES: FaceDef[] = [
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], shade: 1.0 },   // top
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.45 },  // bottom
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], shade: 0.78 },  // +x
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.78 },  // -x
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.63 },   // +z
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], shade: 0.63 }, // -z
];

const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Deterministic per-block tint so large surfaces are not flat
function tint(x: number, y: number, z: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return 0.92 + (n - Math.floor(n)) * 0.16;
}

const TRANSPARENT: Record<string, boolean> = { water: true, leaves: true, flower: true };

function isSolid(blocks: Record<string, BlockType>, x: number, y: number, z: number) {
  const b = blocks[`${x},${y},${z}`];
  return !!b && !TRANSPARENT[b];
}

interface Built {
  positions: Float32Array;
  colors: Float32Array;
  indices: number[];
}

function buildMeshes(blocks: Record<string, BlockType>) {
  const solid: Record<string, { pos: number[]; col: number[]; idx: number[] }> = {};
  const water: number[] = [];
  const waterCol: number[] = [];
  const waterIdx: number[] = [];

  const color = new THREE.Color();
  const dirt = new THREE.Color(BLOCK_COLORS.dirt || '#8B5A2B');

  Object.entries(blocks).forEach(([key, type]) => {
    const [x, y, z] = key.split(',').map(Number);

    if (type === 'water') {
      // only render the top surface of water bodies
      if (blocks[`${x},${y + 1},${z}`] === 'water') return;
      const base = water.length / 3;
      const h = 0.86;
      water.push(x, y + h, z, x + 1, y + h, z, x + 1, y + h, z + 1, x, y + h, z + 1);
      for (let i = 0; i < 4; i++) waterCol.push(0.16, 0.45, 0.78);
      waterIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      return;
    }

    const baseColor = new THREE.Color(BLOCK_COLORS[type] || '#808080');
    const t = tint(x, y, z);
    const bucketKey = TRANSPARENT[type] ? `${type}__t` : 'opaque';
    if (!solid[bucketKey]) solid[bucketKey] = { pos: [], col: [], idx: [] };
    const bucket = solid[bucketKey];

    for (const face of FACES) {
      const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
      const neighbour = blocks[`${nx},${ny},${nz}`];
      // hide faces touching another opaque block of interest
      if (neighbour && !TRANSPARENT[neighbour]) continue;
      if (neighbour && TRANSPARENT[neighbour] && TRANSPARENT[type] && neighbour === type) continue;

      // grass blocks fade to dirt on their sides
      color.copy(baseColor);
      if (type === 'grass' && face.n[1] === 0) color.lerp(dirt, 0.45);
      if (type === 'grass' && face.n[1] === -1) color.copy(dirt);

      const start = bucket.pos.length / 3;
      const aos: number[] = [];

      for (const [du, dv] of CORNERS) {
        const px = x + 0.5 + face.n[0] * 0.5 + (face.u[0] * du + face.v[0] * dv) * 0.5;
        const py = y + 0.5 + face.n[1] * 0.5 + (face.u[1] * du + face.v[1] * dv) * 0.5;
        const pz = z + 0.5 + face.n[2] * 0.5 + (face.u[2] * du + face.v[2] * dv) * 0.5;
        bucket.pos.push(px, py, pz);

        // classic voxel ambient occlusion
        const s1 = isSolid(blocks, nx + face.u[0] * du, ny + face.u[1] * du, nz + face.u[2] * du);
        const s2 = isSolid(blocks, nx + face.v[0] * dv, ny + face.v[1] * dv, nz + face.v[2] * dv);
        const cr = isSolid(
          blocks,
          nx + face.u[0] * du + face.v[0] * dv,
          ny + face.u[1] * du + face.v[1] * dv,
          nz + face.u[2] * du + face.v[2] * dv,
        );
        const level = s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(cr));
        const ao = 0.55 + (level / 3) * 0.45;
        aos.push(ao);

        const k = face.shade * t * ao;
        bucket.col.push(color.r * k, color.g * k, color.b * k);
      }

      // flip quad diagonal to avoid AO artefacts
      if (aos[0] + aos[2] > aos[1] + aos[3]) {
        bucket.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
      } else {
        bucket.idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start);
      }
    }
  });

  const meshes: { key: string; geo: THREE.BufferGeometry; transparent: boolean }[] = [];
  Object.entries(solid).forEach(([key, b]) => {
    if (b.pos.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    geo.computeBoundingSphere();
    meshes.push({ key, geo, transparent: key.endsWith('__t') });
  });

  let waterGeo: THREE.BufferGeometry | null = null;
  if (water.length) {
    waterGeo = new THREE.BufferGeometry();
    waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(water, 3));
    waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(waterCol, 3));
    waterGeo.setIndex(waterIdx);
    waterGeo.computeBoundingSphere();
  }

  return { meshes, waterGeo };
}

function Water({ geometry }: { geometry: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 1.2) * 0.05;
  });
  return (
    <mesh ref={ref} geometry={geometry} frustumCulled={false} renderOrder={2}>
      <meshBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Terrain({ blocks }: TerrainProps) {
  const { meshes, waterGeo } = useMemo(() => buildMeshes(blocks), [blocks]);

  return (
    <>
      {meshes.map(({ key, geo, transparent }) => (
        <mesh key={key} geometry={geo} frustumCulled={false}>
          <meshBasicMaterial
            vertexColors
            transparent={transparent}
            opacity={transparent ? 0.95 : 1}
            alphaTest={transparent ? 0.1 : 0}
          />
        </mesh>
      ))}
      {waterGeo && <Water geometry={waterGeo} />}
    </>
  );
}
