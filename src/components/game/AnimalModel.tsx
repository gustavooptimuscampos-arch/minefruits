import { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type AnimalType = 'cow' | 'pig' | 'sheep' | 'chicken';
export const ANIMAL_TYPES: AnimalType[] = ['cow', 'pig', 'sheep', 'chicken'];

type V3 = [number, number, number];

function Box({ size, pos = [0, 0, 0], color }: { size: V3; pos?: V3; color: string }) {
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  );
}

interface Spec {
  legH: number; legW: number; legColor: string; legSpread: [number, number];
  body: V3; bodyColor: string;
  head: V3; headPos: V3; headColor: string;
  bipedal?: boolean;
}

const SPECS: Record<AnimalType, Spec> = {
  pig: { legH: 0.37, legW: 0.25, legColor: '#e89a98', legSpread: [0.19, 0.32], body: [0.62, 0.5, 0.95], bodyColor: '#f0a8a5', head: [0.5, 0.5, 0.5], headPos: [0, 0.72, 0.62], headColor: '#f0a8a5' },
  cow: { legH: 0.75, legW: 0.25, legColor: '#3d2a1e', legSpread: [0.25, 0.4], body: [0.75, 0.62, 1.1], bodyColor: '#4a3426', head: [0.5, 0.5, 0.38], headPos: [0, 1.25, 0.68], headColor: '#4a3426' },
  sheep: { legH: 0.75, legW: 0.22, legColor: '#d9c5ad', legSpread: [0.22, 0.38], body: [0.8, 0.7, 1.05], bodyColor: '#eeeeea', head: [0.38, 0.42, 0.5], headPos: [0, 1.2, 0.62], headColor: '#d9c5ad' },
  chicken: { legH: 0.3, legW: 0.06, legColor: '#e8b33a', legSpread: [0.08, 0], body: [0.37, 0.37, 0.5], bodyColor: '#f5f5f2', head: [0.25, 0.37, 0.19], headPos: [0, 0.75, 0.25], headColor: '#f5f5f2', bipedal: true },
};

/** Animal modelado em blocos no estilo Minecraft. Origem = pés no chão, frente = +Z. */
export function AnimalModel({ type, moving }: { type: AnimalType; moving: MutableRefObject<number> }) {
  const s = SPECS[type];
  const legs = useRef<(THREE.Group | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);
  const idle = useRef(Math.random() * 10);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const m = moving.current;
    phase.current += dt * (type === 'chicken' ? 14 : 8) * m;
    idle.current += dt;
    const swing = Math.sin(phase.current) * 0.6 * m;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const sign = (i === 0 || i === 3) ? 1 : -1;
      l.rotation.x = swing * sign;
    });
    if (head.current) {
      // Olhar em volta / pastar quando parado
      const graze = type !== 'chicken' && m < 0.2 ? Math.max(0, Math.sin(idle.current * 0.4)) * 0.9 : 0;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, graze, 1 - Math.exp(-3 * dt));
      head.current.rotation.y = Math.sin(idle.current * 0.7) * 0.25 * (1 - m);
      if (type === 'chicken') head.current.position.z = s.headPos[2] + Math.sin(phase.current * 2) * 0.03 * m;
    }
  });

  const [sx, sz] = s.legSpread;
  const legPos: V3[] = s.bipedal
    ? [[sx, s.legH, 0], [-sx, s.legH, 0]]
    : [[sx, s.legH, sz], [-sx, s.legH, sz], [sx, s.legH, -sz], [-sx, s.legH, -sz]];
  const bodyY = s.legH + s.body[1] / 2;
  const [hw, hh, hd] = s.head;
  const face = hd / 2 + 0.005;

  return (
    <group>
      {legPos.map((p, i) => (
        <group key={i} position={p} ref={el => (legs.current[i] = el)}>
          <Box size={[s.legW, s.legH, s.legW]} pos={[0, -s.legH / 2, 0]} color={s.legColor} />
          {type === 'chicken' && <Box size={[0.18, 0.02, 0.18]} pos={[0, -s.legH + 0.01, 0.04]} color={s.legColor} />}
        </group>
      ))}

      <Box size={s.body} pos={[0, bodyY, 0]} color={s.bodyColor} />

      {type === 'cow' && (<>
        <Box size={[0.3, 0.3, 0.4]} pos={[s.body[0] / 2 + 0.003, bodyY + 0.05, 0.1]} color="#e8e4dc" />
        <Box size={[0.35, 0.25, 0.3]} pos={[-s.body[0] / 2 - 0.003, bodyY - 0.08, -0.25]} color="#e8e4dc" />
        <Box size={[0.4, 0.2, 0.3]} pos={[0.1, bodyY + s.body[1] / 2 + 0.003, -0.2]} color="#e8e4dc" />
        <Box size={[0.25, 0.12, 0.25]} pos={[0, s.legH + 0.02, -0.25]} color="#e9a8b0" />
      </>)}
      {type === 'sheep' && <Box size={[s.body[0] + 0.06, 0.25, s.body[2] * 0.6]} pos={[0, s.legH + 0.15, 0]} color="#e2e2dd" />}
      {type === 'pig' && <Box size={[0.06, 0.1, 0.06]} pos={[0.1, bodyY + 0.12, -s.body[2] / 2 - 0.03]} color="#e08c8a" />}
      {type === 'chicken' && (<>
        <Box size={[0.06, 0.25, 0.37]} pos={[s.body[0] / 2 + 0.03, bodyY + 0.02, 0]} color="#e8e8e4" />
        <Box size={[0.06, 0.25, 0.37]} pos={[-s.body[0] / 2 - 0.03, bodyY + 0.02, 0]} color="#e8e8e4" />
      </>)}

      <group ref={head} position={s.headPos}>
        <Box size={s.head} color={s.headColor} />
        {/* Olhos */}
        {[1, -1].map(sd => (
          <group key={sd}>
            <Box size={[hw * 0.18, hh * 0.14, 0.01]} pos={[sd * hw * 0.3, hh * 0.12, face]} color="#f4f4f4" />
            <Box size={[hw * 0.1, hh * 0.14, 0.012]} pos={[sd * hw * 0.36, hh * 0.12, face]} color="#1a1a1a" />
          </group>
        ))}
        {type === 'pig' && (<>
          <Box size={[0.25, 0.18, 0.06]} pos={[0, -0.06, face + 0.03]} color="#f5bcb8" />
          <Box size={[0.05, 0.06, 0.01]} pos={[0.06, -0.06, face + 0.065]} color="#9a5554" />
          <Box size={[0.05, 0.06, 0.01]} pos={[-0.06, -0.06, face + 0.065]} color="#9a5554" />
        </>)}
        {type === 'cow' && (<>
          <Box size={[0.3, 0.18, 0.06]} pos={[0, -0.14, face + 0.03]} color="#c9b49a" />
          <Box size={[0.06, 0.15, 0.06]} pos={[0.28, 0.25, 0.05]} color="#d8d2c2" />
          <Box size={[0.06, 0.15, 0.06]} pos={[-0.28, 0.25, 0.05]} color="#d8d2c2" />
          <Box size={[0.12, 0.08, 0.04]} pos={[0.3, 0.12, -0.05]} color="#3d2a1e" />
          <Box size={[0.12, 0.08, 0.04]} pos={[-0.3, 0.12, -0.05]} color="#3d2a1e" />
        </>)}
        {type === 'sheep' && <Box size={[hw + 0.06, hh * 0.5, hd * 0.75]} pos={[0, hh * 0.32, -hd * 0.15]} color="#eeeeea" />}
        {type === 'chicken' && (<>
          <Box size={[0.25, 0.12, 0.12]} pos={[0, 0.02, face + 0.06]} color="#f0a020" />
          <Box size={[0.12, 0.12, 0.06]} pos={[0, -0.1, face + 0.03]} color="#d42a2a" />
        </>)}
      </group>
    </group>
  );
}
