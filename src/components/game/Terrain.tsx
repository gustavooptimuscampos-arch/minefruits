import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_COLORS, GRASS_BLOCKS } from './types';
import { lightState } from './lightState';
import { BLOCK_TYPES, World, WATER_ID } from './world';
import { WATER_LEVEL } from './biomes';

interface TerrainProps {
  world: World;
  /** Muda quando algum bloco muda; cada chunk só se redesenha se for o dele. */
  version: number;
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

// Tabelas por id de bloco (mais rápido que comparar textos no meio do desenho)
const TRANSPARENT_TYPES = new Set(['water', 'leaves', 'flower', 'spruce_leaves', 'jungle_leaves', 'acacia_leaves']);
const TRANSPARENT_ID: boolean[] = [false, ...BLOCK_TYPES.map(t => TRANSPARENT_TYPES.has(t))];
const GRASS_ID: boolean[] = [false, ...BLOCK_TYPES.map(t => GRASS_BLOCKS.includes(t))];
const COLOR_ID: THREE.Color[] = [new THREE.Color(), ...BLOCK_TYPES.map(t => new THREE.Color(BLOCK_COLORS[t] || '#808080'))];
const DIRT = new THREE.Color(BLOCK_COLORS.dirt);
const FLOWER_ID = BLOCK_TYPES.indexOf('flower') + 1;
const STEM = new THREE.Color('#3f8f3a');

type Bucket = { pos: number[]; col: number[]; idx: number[] };

/** Caixinha simples (sem sombra de canto), usada para desenhar flores pequenas. */
function addBox(b: Bucket, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: THREE.Color, k = 1) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const quads: [number[], number][] = [
    [[x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1], 1.0],  // topo
    [[x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], 0.75], // frente
    [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], 0.75], // trás
    [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], 0.62], // direita
    [[x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], 0.62], // esquerda
  ];
  for (const [v, shade] of quads) {
    const start = b.pos.length / 3;
    b.pos.push(...v);
    for (let i = 0; i < 4; i++) b.col.push(color.r * shade * k, color.g * shade * k, color.b * shade * k);
    // Garante que a face aponta para fora da caixa (senão ela some)
    const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2];
    const wx = v[6] - v[0], wy = v[7] - v[1], wz = v[8] - v[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const ox = (v[0] + v[6]) / 2 - cx, oy = (v[1] + v[7]) / 2 - cy, oz = (v[2] + v[8]) / 2 - cz;
    if (nx * ox + ny * oy + nz * oz > 0) b.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
    else b.idx.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }
}

function buildChunk(world: World, cx: number, cz: number) {
  const opaque = { pos: [] as number[], col: [] as number[], idx: [] as number[] };
  const leafy = { pos: [] as number[], col: [] as number[], idx: [] as number[] };
  const water: number[] = [];
  const waterCol: number[] = [];
  const waterIdx: number[] = [];
  const color = new THREE.Color();

  const solidAt = (x: number, y: number, z: number) => {
    const id = world.getId(x, y, z);
    return id !== 0 && !TRANSPARENT_ID[id];
  };

  const { x0, z0, x1, z1 } = world.chunkBounds(cx, cz);
  const maxY = world.chunkMaxY(cx, cz, WATER_LEVEL);

  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const surface = world.groundHeight(x, z);
      for (let y = 0; y <= maxY; y++) {
        const id = world.getId(x, y, z);
        if (!id) continue;

        if (id === WATER_ID) {
          // only render the top surface of water bodies
          if (world.getId(x, y + 1, z) === WATER_ID) continue;
          const base = water.length / 3;
          const h = 0.86;
          water.push(x, y + h, z, x + 1, y + h, z, x + 1, y + h, z + 1, x, y + h, z + 1);
          for (let i = 0; i < 4; i++) waterCol.push(0.16, 0.45, 0.78);
          waterIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
          continue;
        }

        // Flor: um caule e uma florzinha, em vez de um cubo inteiro rosa
        if (id === FLOWER_ID) {
          addBox(leafy, x + 0.46, y, z + 0.46, x + 0.54, y + 0.45, z + 0.54, STEM);
          addBox(leafy, x + 0.34, y + 0.4, z + 0.34, x + 0.66, y + 0.66, z + 0.66, COLOR_ID[id], tint(x, y, z));
          continue;
        }

        const transparent = TRANSPARENT_ID[id];
        const bucket = transparent ? leafy : opaque;
        const t = tint(x, y, z);
        // Quanto mais fundo, mais escuro (cavernas e ravinas ficam sombrias)
        const depth = surface - 1 - y;
        const dark = depth > 4 ? Math.max(0.42, 1 - (depth - 4) / 26) : 1;

        for (const face of FACES) {
          const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
          if (ny < 0) continue; // fundo do mundo nunca aparece
          const nid = world.getId(nx, ny, nz);
          // hide faces touching another opaque block
          if (nid && !TRANSPARENT_ID[nid]) continue;
          if (nid && transparent && nid === id) continue;

          // grass blocks fade to dirt on their sides
          color.copy(COLOR_ID[id]);
          if (GRASS_ID[id] && face.n[1] === 0) color.lerp(DIRT, 0.45);
          if (GRASS_ID[id] && face.n[1] === -1) color.copy(DIRT);

          const start = bucket.pos.length / 3;
          const aos: number[] = [];

          for (const [du, dv] of CORNERS) {
            const px = x + 0.5 + face.n[0] * 0.5 + (face.u[0] * du + face.v[0] * dv) * 0.5;
            const py = y + 0.5 + face.n[1] * 0.5 + (face.u[1] * du + face.v[1] * dv) * 0.5;
            const pz = z + 0.5 + face.n[2] * 0.5 + (face.u[2] * du + face.v[2] * dv) * 0.5;
            bucket.pos.push(px, py, pz);

            // classic voxel ambient occlusion
            const s1 = solidAt(nx + face.u[0] * du, ny + face.u[1] * du, nz + face.u[2] * du);
            const s2 = solidAt(nx + face.v[0] * dv, ny + face.v[1] * dv, nz + face.v[2] * dv);
            const cr = solidAt(
              nx + face.u[0] * du + face.v[0] * dv,
              ny + face.u[1] * du + face.v[1] * dv,
              nz + face.u[2] * du + face.v[2] * dv,
            );
            const level = s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(cr));
            const ao = 0.55 + (level / 3) * 0.45;
            aos.push(ao);

            const k = face.shade * t * ao * dark;
            bucket.col.push(color.r * k, color.g * k, color.b * k);
          }

          // flip quad diagonal to avoid AO artefacts
          if (aos[0] + aos[2] > aos[1] + aos[3]) {
            bucket.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
          } else {
            bucket.idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start);
          }
        }
      }
    }
  }

  const toGeo = (pos: number[], col: number[], idx: number[]) => {
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  };

  return {
    opaque: toGeo(opaque.pos, opaque.col, opaque.idx),
    leafy: toGeo(leafy.pos, leafy.col, leafy.idx),
    water: toGeo(water, waterCol, waterIdx),
  };
}

function Water({ geometry }: { geometry: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 1.2) * 0.05;
  });
  return (
    <mesh ref={ref} geometry={geometry} renderOrder={2}>
      <meshBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ChunkMesh({ geometry, transparent }: { geometry: THREE.BufferGeometry; transparent: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (matRef.current) matRef.current.color.copy(lightState.tint);
  });
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        ref={matRef}
        vertexColors
        transparent={transparent}
        opacity={transparent ? 0.95 : 1}
        alphaTest={transparent ? 0.1 : 0}
      />
    </mesh>
  );
}

/** Um pedaço 16x16 do mapa. Só é redesenhado quando um bloco dele muda. */
function Chunk({ world, cx, cz, version }: { world: World; cx: number; cz: number; version: number }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- "version" é o que avisa que o chunk mudou
  const geos = useMemo(() => buildChunk(world, cx, cz), [world, cx, cz, version]);
  useEffect(() => () => {
    geos.opaque?.dispose();
    geos.leafy?.dispose();
    geos.water?.dispose();
  }, [geos]);
  return (
    <>
      {geos.opaque && <ChunkMesh geometry={geos.opaque} transparent={false} />}
      {geos.leafy && <ChunkMesh geometry={geos.leafy} transparent />}
      {geos.water && <Water geometry={geos.water} />}
    </>
  );
}

/** Recebe "version" só para redesenhar quando algo muda; cada Chunk confere a sua. */
export function Terrain({ world }: TerrainProps) {
  const chunks: [number, number][] = [];
  for (let cx = 0; cx < world.chunksPerSide; cx++) for (let cz = 0; cz < world.chunksPerSide; cz++) chunks.push([cx, cz]);
  return (
    <>
      {chunks.map(([cx, cz]) => (
        <Chunk key={`${cx},${cz}`} world={world} cx={cx} cz={cz} version={world.chunkVersion(cx, cz)} />
      ))}
    </>
  );
}
