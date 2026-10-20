import { useMemo } from 'react';
import * as THREE from 'three';
import type { BlockType, ItemType } from './types';
import { blockUV, getBlockAtlas } from './blockTextures';

/**
 * Modelos 3D dos itens que o jogador segura: ferramentas (picareta, machado, espada) com cabo de
 * madeira e cabeça do material certo, blocos com textura, minérios, lingotes e comida.
 * Origem = onde a mão segura; o item aponta para cima (+Y).
 */

type V3 = [number, number, number];
type Mat = 'wood' | 'stone' | 'iron' | 'diamond' | 'gold';

const matCache = new Map<string, THREE.Material>();
function std(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
// Cabeça da ferramenta: cada material com o brilho certo (ferro metálico, diamante brilhante...)
function headMat(m: Mat) {
  return std(`head:${m}`, () => {
    switch (m) {
      case 'wood': return new THREE.MeshStandardMaterial({ color: '#a8804a', roughness: 0.85 });
      case 'stone': return new THREE.MeshStandardMaterial({ color: '#8c8c8c', roughness: 0.95 });
      case 'iron': return new THREE.MeshStandardMaterial({ color: '#e4e8ec', roughness: 0.3, metalness: 0.45, emissive: '#2a2e33', emissiveIntensity: 0.4 });
      case 'gold': return new THREE.MeshStandardMaterial({ color: '#f6cf4a', roughness: 0.3, metalness: 0.45, emissive: '#3a2a00', emissiveIntensity: 0.4 });
      case 'diamond': return new THREE.MeshStandardMaterial({ color: '#5ee9dd', roughness: 0.12, metalness: 0.25, emissive: '#0b5d57', emissiveIntensity: 0.6 });
    }
  });
}
const edgeMat = (m: Mat) => std(`edge:${m}`, () => {
  const base = (headMat(m) as THREE.MeshStandardMaterial).clone();
  base.color.multiplyScalar(m === 'wood' || m === 'stone' ? 1.15 : 1.08); // fio da lâmina mais claro
  return base;
});
const solid = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  std(`c:${color}:${JSON.stringify(opts)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));

const HANDLE = () => solid('#7a5330', { roughness: 0.9 });
const HANDLE_DARK = () => solid('#5c3d22', { roughness: 0.9 });
const box = new THREE.BoxGeometry(1, 1, 1);

function B({ s, p = [0, 0, 0], r, m }: { s: V3; p?: V3; r?: V3; m: THREE.Material }) {
  return <mesh geometry={box} scale={s} position={p} rotation={r} material={m} />;
}

/** Cabo de madeira com faixas de pegada. */
function Handle({ len = 0.78 }: { len?: number }) {
  return (
    <group>
      <B s={[0.065, len, 0.065]} p={[0, len / 2 - 0.12, 0]} m={HANDLE()} />
      {[-0.06, 0.02, 0.1].map(y => <B key={y} s={[0.072, 0.025, 0.072]} p={[0, y, 0]} m={HANDLE_DARK()} />)}
    </group>
  );
}

function Pickaxe({ m }: { m: Mat }) {
  const h = headMat(m), e = edgeMat(m);
  return (
    <group>
      <Handle />
      {/* cabeça curva em arco, com pontas afiadas */}
      <group position={[0, 0.6, 0]}>
        <B s={[0.16, 0.11, 0.1]} m={h} />
        <B s={[0.16, 0.085, 0.085]} p={[0.14, -0.025, 0]} r={[0, 0, -0.25]} m={h} />
        <B s={[0.16, 0.085, 0.085]} p={[-0.14, -0.025, 0]} r={[0, 0, 0.25]} m={h} />
        <B s={[0.12, 0.06, 0.065]} p={[0.27, -0.08, 0]} r={[0, 0, -0.55]} m={e} />
        <B s={[0.12, 0.06, 0.065]} p={[-0.27, -0.08, 0]} r={[0, 0, 0.55]} m={e} />
      </group>
    </group>
  );
}

function Axe({ m }: { m: Mat }) {
  const h = headMat(m), e = edgeMat(m);
  return (
    <group>
      <Handle />
      <group position={[0, 0.54, 0]}>
        <B s={[0.1, 0.14, 0.09]} m={h} />
        {/* lâmina larga de um lado só, com o fio mais claro */}
        <B s={[0.18, 0.22, 0.05]} p={[0.13, -0.01, 0]} m={h} />
        <B s={[0.04, 0.3, 0.055]} p={[0.235, -0.01, 0]} m={e} />
        <B s={[0.06, 0.08, 0.07]} p={[-0.07, 0, 0]} m={h} />
      </group>
    </group>
  );
}

function Sword({ m }: { m: Mat }) {
  const h = headMat(m), e = edgeMat(m);
  const guard = m === 'wood' ? HANDLE_DARK() : solid('#5c5c66', { roughness: 0.45, metalness: 0.35 });
  return (
    <group>
      {/* cabo com couro, pomo, guarda e lâmina com sulco no meio */}
      <B s={[0.06, 0.22, 0.06]} p={[0, 0, 0]} m={solid('#5a3a22')} />
      <B s={[0.085, 0.07, 0.085]} p={[0, -0.14, 0]} m={guard} />
      <B s={[0.3, 0.05, 0.09]} p={[0, 0.13, 0]} m={guard} />
      <B s={[0.095, 0.6, 0.028]} p={[0, 0.46, 0]} m={h} />
      <B s={[0.022, 0.52, 0.032]} p={[0, 0.44, 0]} m={e} />
      <B s={[0.067, 0.067, 0.028]} p={[0, 0.77, 0]} r={[0, 0, Math.PI / 4]} m={h} />
    </group>
  );
}

function Shield() {
  const rim = solid('#a9afb5', { metalness: 0.4, roughness: 0.4 });
  return (
    <group position={[0, 0.25, 0]}>
      <B s={[0.5, 0.62, 0.06]} m={solid('#8a6236')} />
      {[-0.12, 0, 0.12].map(x => <B key={x} s={[0.01, 0.6, 0.065]} p={[x, 0, 0]} m={solid('#6e4c28')} />)}
      <B s={[0.54, 0.04, 0.07]} p={[0, 0.31, 0]} m={rim} />
      <B s={[0.54, 0.04, 0.07]} p={[0, -0.31, 0]} m={rim} />
      <B s={[0.04, 0.66, 0.07]} p={[0.27, 0, 0]} m={rim} />
      <B s={[0.04, 0.66, 0.07]} p={[-0.27, 0, 0]} m={rim} />
      <B s={[0.12, 0.12, 0.05]} p={[0, 0, 0.05]} m={rim} />
    </group>
  );
}

function Lance() {
  return (
    <group>
      <B s={[0.06, 1.3, 0.06]} p={[0, 0.45, 0]} m={HANDLE()} />
      <B s={[0.1, 0.1, 0.1]} p={[0, 0.06, 0]} m={solid('#4a4a52', { metalness: 0.7, roughness: 0.4 })} />
      <B s={[0.09, 0.2, 0.03]} p={[0, 1.17, 0]} m={headMat('iron')} />
      <B s={[0.064, 0.064, 0.03]} p={[0, 1.28, 0]} r={[0, 0, Math.PI / 4]} m={headMat('iron')} />
    </group>
  );
}

function Torch() {
  const flame = std('flame', () => new THREE.MeshBasicMaterial({ color: '#ffcc55', toneMapped: false }));
  const core = std('flamecore', () => new THREE.MeshBasicMaterial({ color: '#fff3c0', toneMapped: false }));
  return (
    <group>
      <B s={[0.06, 0.5, 0.06]} p={[0, 0.13, 0]} m={HANDLE()} />
      <B s={[0.075, 0.05, 0.075]} p={[0, 0.38, 0]} m={solid('#2a1a10')} />
      <B s={[0.07, 0.1, 0.07]} p={[0, 0.45, 0]} m={flame} />
      <B s={[0.035, 0.06, 0.035]} p={[0, 0.47, 0]} m={core} />
    </group>
  );
}

function Ingot({ color }: { color: string }) {
  const m = solid(color, { metalness: 0.45, roughness: 0.3, emissive: color, emissiveIntensity: 0.12 });
  return (
    <group position={[0, 0.06, 0]} rotation={[0.3, 0.4, 0]}>
      <B s={[0.26, 0.07, 0.13]} m={m} />
      <B s={[0.21, 0.04, 0.09]} p={[0, 0.05, 0]} m={m} />
    </group>
  );
}

function Gem({ color, emissive }: { color: string; emissive: string }) {
  const m = std(`gem:${color}`, () => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.2, flatShading: true }));
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.12, 0), []);
  return <mesh geometry={geo} material={m} position={[0, 0.12, 0]} scale={[1, 1.25, 1]} />;
}

function Lump({ color, metal = 0 }: { color: string; metal?: number }) {
  const m = solid(color, { roughness: metal ? 0.4 : 0.95, metalness: metal });
  return (
    <group position={[0, 0.08, 0]}>
      <B s={[0.16, 0.13, 0.14]} r={[0.3, 0.5, 0.2]} m={m} />
      <B s={[0.1, 0.1, 0.1]} p={[0.08, 0.04, 0.03]} r={[0.6, 0.2, 0.4]} m={m} />
      <B s={[0.09, 0.08, 0.1]} p={[-0.07, 0.02, -0.03]} r={[0.1, 0.7, 0.5]} m={m} />
    </group>
  );
}

function Meat({ kind }: { kind: 'beef' | 'porkchop' | 'chicken_meat' | 'mutton' }) {
  const fat = solid('#f1e3d2');
  const bone = solid('#efe7d6');
  if (kind === 'chicken_meat') {
    return (
      <group position={[0, 0.1, 0]} rotation={[0, 0, 0.5]}>
        <B s={[0.17, 0.2, 0.15]} p={[0, 0.06, 0]} m={solid('#e3a56a')} />
        <B s={[0.05, 0.16, 0.05]} p={[0, -0.1, 0]} m={bone} />
        <B s={[0.08, 0.05, 0.06]} p={[0, -0.18, 0]} m={bone} />
      </group>
    );
  }
  const color = kind === 'beef' ? '#b5302b' : kind === 'mutton' ? '#a3453c' : '#ea9a92';
  return (
    <group position={[0, 0.06, 0]} rotation={[0.5, 0.3, 0]}>
      <B s={[0.3, 0.08, 0.2]} m={solid(color, { roughness: 0.6 })} />
      {/* gordura em volta e osso (bisteca) */}
      <B s={[0.3, 0.085, 0.03]} p={[0, 0, 0.1]} m={fat} />
      {kind !== 'beef' && <B s={[0.12, 0.05, 0.05]} p={[0.18, 0, 0]} m={bone} />}
      <B s={[0.12, 0.09, 0.03]} p={[-0.03, 0, -0.02]} m={solid(kind === 'beef' ? '#d9524a' : '#f4b4ad')} />
    </group>
  );
}

// ----- Blocos com a textura do mundo -----
const blockGeoCache = new Map<string, THREE.BufferGeometry>();
function blockGeometry(type: BlockType) {
  let g = blockGeoCache.get(type);
  if (g) return g;
  g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // ordem das faces do BoxGeometry: +x, -x, +y (topo), -y (baixo), +z, -z
  const roles = ['side', 'side', 'top', 'bottom', 'side', 'side'] as const;
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = blockUV(type, roles[f]);
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
    }
  }
  uv.needsUpdate = true;
  blockGeoCache.set(type, g);
  return g;
}
const blockMat = () => std('block', () => {
  const { texture, glow } = getBlockAtlas();
  return new THREE.MeshLambertMaterial({ map: texture, emissiveMap: glow, emissive: new THREE.Color(1, 1, 1), alphaTest: 0.5 });
});

function BlockItem({ type }: { type: BlockType }) {
  return <mesh geometry={blockGeometry(type)} material={blockMat()} scale={0.3} position={[0, 0.15, 0]} rotation={[0, Math.PI / 4, 0]} />;
}

function Flower() {
  return (
    <group>
      <B s={[0.03, 0.3, 0.03]} p={[0, 0.12, 0]} m={solid('#3f8f3a')} />
      <B s={[0.07, 0.03, 0.12]} p={[0.04, 0.12, 0]} r={[0, 0, 0.5]} m={solid('#4aa044')} />
      <B s={[0.13, 0.1, 0.13]} p={[0, 0.3, 0]} m={solid('#e91e63')} />
      <B s={[0.05, 0.05, 0.05]} p={[0, 0.34, 0]} m={solid('#ffd54f')} />
    </group>
  );
}

const TOOL_MAT: Record<string, Mat> = { wood: 'wood', stone: 'stone', iron: 'iron', diamond: 'diamond' };
const BLOCK_OF: Partial<Record<ItemType, BlockType>> = {
  wood: 'wood', stone: 'stone', cobblestone: 'cobblestone', planks: 'planks', dirt: 'dirt', sand: 'sand',
  sandstone: 'sandstone', snow: 'snow', leaves: 'leaves', cactus: 'cactus', ice: 'ice', glowstone: 'glowstone',
  netherrack: 'netherrack', nether_brick: 'nether_brick', obsidian: 'obsidian', door: 'door', crafting_table: 'crafting_table',
};

export function ItemModel({ item }: { item: ItemType }) {
  const tool = /^(wood|stone|iron|diamond)_(sword|pickaxe|axe)$/.exec(item);
  if (tool) {
    const m = TOOL_MAT[tool[1]];
    if (tool[2] === 'sword') return <Sword m={m} />;
    if (tool[2] === 'pickaxe') return <Pickaxe m={m} />;
    return <Axe m={m} />;
  }
  const block = BLOCK_OF[item];
  if (block) return <BlockItem type={block} />;
  switch (item) {
    case 'shield': return <Shield />;
    case 'lance': return <Lance />;
    case 'torch': return <Torch />;
    case 'stick': return <Handle len={0.5} />;
    case 'iron_ingot': return <Ingot color="#d9dde2" />;
    case 'gold_ingot': return <Ingot color="#f3c63c" />;
    case 'copper_ingot': return <Ingot color="#d4803a" />;
    case 'diamond': return <Gem color="#5ee9dd" emissive="#0b5d57" />;
    case 'lapis': return <Lump color="#2357c9" metal={0.3} />;
    case 'coal': return <Lump color="#232323" />;
    case 'flower': return <Flower />;
    case 'beef': case 'porkchop': case 'chicken_meat': case 'mutton': return <Meat kind={item} />;
    default: return <B s={[0.2, 0.2, 0.2]} p={[0, 0.1, 0]} m={solid('#999999')} />;
  }
}
