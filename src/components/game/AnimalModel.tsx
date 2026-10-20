import { useMemo, useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type AnimalType = 'cow' | 'pig' | 'sheep' | 'chicken';
export const ANIMAL_TYPES: AnimalType[] = ['cow', 'pig', 'sheep', 'chicken'];

type V3 = [number, number, number];

// ---------- Pelagem desenhada (16x16, pixel) ----------
type Fur = 'cow' | 'cowHead' | 'pig' | 'wool' | 'sheepFace' | 'feathers' | 'hoof' | 'beak' | 'comb' | 'pinkSkin' | 'horn';

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const furCache = new Map<Fur, THREE.CanvasTexture>();
function furTexture(kind: Fur): THREE.CanvasTexture {
  const hit = furCache.get(kind);
  if (hit) return hit;
  const N = 16;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const rand = rng(kind.length * 7919 + kind.charCodeAt(0) * 31);
  const px = (x: number, y: number, r: number, g: number, b: number) => { ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; ctx.fillRect(x, y, 1, 1); };
  const noise = (r: number, g: number, b: number, amount = 0.16) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = 1 - amount / 2 + rand() * amount;
      px(x, y, r * k, g * k, b * k);
    }
  };
  switch (kind) {
    case 'cow': {
      // pelo marrom-escuro com manchas brancas grandes (vaca holandesa)
      noise(64, 44, 32, 0.18);
      const spots = [[3, 4, 2.4], [11, 10, 2.8], [13, 2, 1.6]];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (spots.some(([sx, sy, r]) => Math.hypot(x - sx, y - sy) < r + rand() * 0.9)) { const k = 0.92 + rand() * 0.1; px(x, y, 236 * k, 232 * k, 222 * k); }
      }
      break;
    }
    case 'cowHead': noise(64, 44, 32, 0.15); for (let y = 2; y < 9; y++) for (let x = 6; x < 10; x++) px(x, y, 232, 228, 218); break;
    case 'pig': noise(238, 160, 158, 0.1); for (let i = 0; i < 10; i++) px(rand() * N, rand() * N, 214, 132, 132); break;
    case 'pinkSkin': noise(244, 182, 178, 0.08); break;
    case 'wool': {
      // lã fofa: bolinhas claras e escuras
      noise(232, 230, 224, 0.12);
      for (let i = 0; i < 40; i++) { const x = rand() * N, y = rand() * N; px(x, y, 205, 202, 195); px(x + 1, y, 248, 247, 243); }
      break;
    }
    case 'sheepFace': noise(52, 46, 42, 0.18); break; // ovelha de cara e pernas pretas
    case 'feathers': {
      noise(246, 245, 240, 0.08);
      for (let y = 1; y < N; y += 3) for (let x = 0; x < N; x++) if ((x + y) % 4 === 0) px(x, y, 222, 220, 212);
      break;
    }
    case 'hoof': noise(42, 32, 26, 0.2); break;
    case 'beak': noise(236, 168, 40, 0.12); break;
    case 'comb': noise(206, 36, 36, 0.15); break;
    case 'horn': noise(222, 214, 192, 0.1); break;
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  furCache.set(kind, t);
  return t;
}

const matCache = new Map<string, THREE.MeshLambertMaterial>();
function material(fur?: Fur, color?: string) {
  const key = `${fur ?? ''}|${color ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ map: fur ? furTexture(fur) : null, color: color ?? '#ffffff' });
    matCache.set(key, m);
  }
  return m;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

/** Bloco do corpo: tamanho, posição e pelagem (ou cor lisa). */
function Box({ size, pos = [0, 0, 0], fur, color, rot }: { size: V3; pos?: V3; fur?: Fur; color?: string; rot?: V3 }) {
  return <mesh position={pos} rotation={rot} scale={size} geometry={boxGeo} material={material(fur, color)} castShadow />;
}

interface Spec {
  legH: number; legW: number; legFur: Fur; legSpread: [number, number];
  body: V3; bodyFur: Fur;
  head: V3; headPos: V3; headFur: Fur;
  bipedal?: boolean;
}

const SPECS: Record<AnimalType, Spec> = {
  pig: { legH: 0.34, legW: 0.22, legFur: 'pig', legSpread: [0.19, 0.3], body: [0.62, 0.52, 0.98], bodyFur: 'pig', head: [0.48, 0.46, 0.44], headPos: [0, 0.74, 0.64], headFur: 'pig' },
  cow: { legH: 0.72, legW: 0.22, legFur: 'cow', legSpread: [0.24, 0.4], body: [0.78, 0.66, 1.18], bodyFur: 'cow', head: [0.46, 0.48, 0.42], headPos: [0, 1.28, 0.74], headFur: 'cowHead' },
  sheep: { legH: 0.6, legW: 0.16, legFur: 'sheepFace', legSpread: [0.2, 0.34], body: [0.86, 0.74, 1.08], bodyFur: 'wool', head: [0.34, 0.38, 0.42], headPos: [0, 1.12, 0.66], headFur: 'sheepFace' },
  chicken: { legH: 0.28, legW: 0.05, legFur: 'beak', legSpread: [0.08, 0], body: [0.36, 0.38, 0.5], bodyFur: 'feathers', head: [0.22, 0.34, 0.2], headPos: [0, 0.78, 0.24], headFur: 'feathers', bipedal: true },
};

/** Animal em blocos, mais detalhado: pelagem, cascos, focinho, rabo, orelhas e jeito de andar. Origem = pés, frente = +Z. */
export function AnimalModel({ type, moving }: { type: AnimalType; moving: MutableRefObject<number> }) {
  const s = SPECS[type];
  const legs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const ears = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const seed = useMemo(() => Math.random() * 100, []);
  const phase = useRef(seed);
  const idle = useRef(seed);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const m = moving.current;
    phase.current += dt * (type === 'chicken' ? 15 : 7.5) * m;
    idle.current += dt;
    const t = idle.current;
    // Passo em diagonal (frente-esquerda com trás-direita), como um quadrúpede de verdade
    const swing = Math.sin(phase.current) * 0.55 * m;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const sign = (i === 0 || i === 3) ? 1 : -1;
      l.rotation.x = swing * sign;
    });
    if (body.current) {
      // respira parado; balança ao andar
      body.current.position.y = Math.abs(Math.sin(phase.current)) * 0.03 * m;
      body.current.scale.y = 1 + Math.sin(t * 2.2) * 0.012 * (1 - m);
      body.current.rotation.z = Math.sin(phase.current) * 0.03 * m;
    }
    if (head.current) {
      // pasta de vez em quando, olha em volta, e o pescoço acompanha o passo
      const grazeWave = Math.sin(t * 0.35 + seed);
      const graze = type !== 'chicken' && m < 0.2 && grazeWave > 0.3 ? (grazeWave - 0.3) * 1.3 : 0;
      const peck = type === 'chicken' && m < 0.2 && Math.sin(t * 1.3 + seed) > 0.7 ? 0.9 : 0;
      const nod = Math.sin(phase.current * 2) * 0.06 * m;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, graze + peck + nod, 1 - Math.exp(-5 * dt));
      head.current.rotation.y = Math.sin(t * 0.6 + seed) * 0.3 * (1 - m);
      if (type === 'chicken') head.current.position.z = s.headPos[2] + Math.sin(phase.current * 2) * 0.04 * m;
    }
    if (tail.current) {
      // rabo balança (a vaca espanta mosca)
      tail.current.rotation.z = Math.sin(t * (type === 'cow' ? 2.4 : 4) + seed) * (type === 'pig' ? 0.15 : 0.35);
      tail.current.rotation.x = 0.25 + Math.sin(phase.current) * 0.1 * m;
    }
    ears.current.forEach((e, i) => {
      if (!e) return;
      // orelhas mexem de vez em quando
      const twitch = Math.sin(t * 3 + i * 1.7 + seed) > 0.96 ? 0.35 : 0;
      e.rotation.z = (i === 0 ? -1 : 1) * (0.2 + twitch);
    });
    wings.current.forEach((w, i) => {
      if (!w) return;
      // galinha bate as asas ao correr e às vezes parada
      const flap = m > 0.5 || Math.sin(t * 0.8 + seed) > 0.97 ? Math.abs(Math.sin(t * 22)) * 0.9 : 0;
      w.rotation.z = (i === 0 ? -1 : 1) * flap;
    });
  });

  const [sx, sz] = s.legSpread;
  const legPos: V3[] = s.bipedal
    ? [[sx, s.legH, 0], [-sx, s.legH, 0]]
    : [[sx, s.legH, sz], [-sx, s.legH, sz], [sx, s.legH, -sz], [-sx, s.legH, -sz]];
  const bodyY = s.legH + s.body[1] / 2;
  const [hw, hh, hd] = s.head;
  const face = hd / 2;
  const back = -s.body[2] / 2;

  const Eye = ({ x, y }: { x: number; y: number }) => (
    <group position={[x, y, face + 0.006]}>
      <Box size={[hw * 0.2, hh * 0.16, 0.012]} color="#f6f4ee" />
      <Box size={[hw * 0.1, hh * 0.16, 0.016]} pos={[Math.sign(x) * hw * 0.05, 0, 0.002]} color="#151515" />
      <Box size={[0.012, 0.012, 0.02]} pos={[Math.sign(x) * hw * 0.03, hh * 0.04, 0.004]} color="#ffffff" />
    </group>
  );

  return (
    <group>
      {legPos.map((p, i) => (
        <group key={i} position={p} ref={el => (legs.current[i] = el)}>
          <Box size={[s.legW, s.legH, s.legW]} pos={[0, -s.legH / 2, 0]} fur={s.legFur} />
          {/* casco / pé */}
          {type !== 'chicken'
            ? <Box size={[s.legW + 0.01, 0.1, s.legW + 0.01]} pos={[0, -s.legH + 0.05, 0]} fur="hoof" />
            : <Box size={[0.16, 0.02, 0.2]} pos={[0, -s.legH + 0.01, 0.05]} fur="beak" />}
        </group>
      ))}

      <group ref={body}>
        <Box size={s.body} pos={[0, bodyY, 0]} fur={s.bodyFur} />

        {type === 'cow' && (<>
          {/* úbere */}
          <Box size={[0.26, 0.12, 0.26]} pos={[0, s.legH - 0.02, -0.22]} fur="pinkSkin" />
          {[[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.07], [0.07, 0.07]].map(([x, z], i) => (
            <Box key={i} size={[0.035, 0.06, 0.035]} pos={[x, s.legH - 0.1, -0.22 + z]} fur="pinkSkin" />
          ))}
        </>)}
        {type === 'sheep' && (
          // lã fofa um pouco maior que o corpo
          <Box size={[s.body[0] + 0.08, s.body[1] + 0.06, s.body[2] + 0.04]} pos={[0, bodyY + 0.02, 0]} fur="wool" />
        )}
        {type === 'chicken' && [1, -1].map((sd, i) => (
          <group key={sd} position={[sd * (s.body[0] / 2), bodyY + 0.1, 0]} ref={el => (wings.current[i] = el)}>
            <Box size={[0.05, 0.24, 0.36]} pos={[sd * 0.025, -0.1, 0]} fur="feathers" />
          </group>
        ))}

        {/* rabo */}
        <group ref={tail} position={[0, bodyY + s.body[1] * (type === 'chicken' ? 0.2 : 0.35), back]}>
          {type === 'cow' && (<>
            <Box size={[0.07, 0.5, 0.07]} pos={[0, -0.25, -0.03]} fur="cow" />
            <Box size={[0.11, 0.12, 0.11]} pos={[0, -0.52, -0.03]} fur="hoof" />
          </>)}
          {type === 'pig' && (<>
            <Box size={[0.05, 0.05, 0.12]} pos={[0, 0, -0.05]} fur="pig" />
            <Box size={[0.05, 0.1, 0.05]} pos={[0.03, 0.05, -0.1]} fur="pig" />
          </>)}
          {type === 'sheep' && <Box size={[0.16, 0.2, 0.12]} pos={[0, -0.06, -0.05]} fur="wool" />}
          {type === 'chicken' && <Box size={[0.24, 0.26, 0.14]} pos={[0, 0.08, -0.04]} rot={[-0.5, 0, 0]} fur="feathers" />}
        </group>
      </group>

      <group ref={head} position={s.headPos}>
        <Box size={s.head} fur={s.headFur} />
        <Eye x={hw * 0.3} y={hh * 0.14} />
        <Eye x={-hw * 0.3} y={hh * 0.14} />

        {/* orelhas */}
        {type !== 'chicken' && [1, -1].map((sd, i) => (
          <group key={sd} position={[sd * hw / 2, hh * 0.28, 0]} ref={el => (ears.current[i] = el)}>
            <Box size={[type === 'pig' ? 0.12 : 0.16, 0.07, type === 'pig' ? 0.1 : 0.08]} pos={[sd * 0.07, 0, 0]} fur={type === 'sheep' ? 'sheepFace' : s.headFur === 'cowHead' ? 'cow' : 'pig'} />
          </group>
        ))}

        {type === 'pig' && (<>
          <Box size={[0.24, 0.17, 0.07]} pos={[0, -0.07, face + 0.035]} fur="pinkSkin" />
          <Box size={[0.05, 0.06, 0.01]} pos={[0.055, -0.07, face + 0.072]} color="#7a3f40" />
          <Box size={[0.05, 0.06, 0.01]} pos={[-0.055, -0.07, face + 0.072]} color="#7a3f40" />
        </>)}
        {type === 'cow' && (<>
          {/* focinho com narinas e chifres */}
          <Box size={[0.32, 0.19, 0.08]} pos={[0, -0.14, face + 0.04]} fur="pinkSkin" />
          <Box size={[0.05, 0.05, 0.01]} pos={[0.08, -0.12, face + 0.082]} color="#5a2e2e" />
          <Box size={[0.05, 0.05, 0.01]} pos={[-0.08, -0.12, face + 0.082]} color="#5a2e2e" />
          <Box size={[0.06, 0.16, 0.06]} pos={[0.2, 0.3, 0.02]} rot={[0, 0, -0.35]} fur="horn" />
          <Box size={[0.06, 0.16, 0.06]} pos={[-0.2, 0.3, 0.02]} rot={[0, 0, 0.35]} fur="horn" />
        </>)}
        {type === 'sheep' && <Box size={[hw + 0.08, hh * 0.38, hd * 0.6]} pos={[0, hh * 0.38, -hd * 0.2]} fur="wool" />}
        {type === 'chicken' && (<>
          <Box size={[0.12, 0.08, 0.12]} pos={[0, 0.0, face + 0.06]} fur="beak" />
          <Box size={[0.08, 0.1, 0.05]} pos={[0, -0.11, face + 0.02]} fur="comb" />
          <Box size={[0.05, 0.1, 0.16]} pos={[0, hh / 2 + 0.05, 0.02]} fur="comb" />
        </>)}
      </group>
    </group>
  );
}
