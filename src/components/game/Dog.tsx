import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BlockType } from './types';
import { getGroundHeight } from './terrainGenerator';
import { mobRegistry } from './MobsRenderer';

const FUR = '#d9d4cc';
const DARK = '#b8b0a4';
const COLLAR = '#c62828';
const SPEED = 4.5;
const SPRINT = 7;
const GUARD_RADIUS = 12;
const BITE_DAMAGE = 7;

function Box({ size, pos = [0, 0, 0], color }: { size: [number, number, number]; pos?: [number, number, number]; color: string }) {
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  );
}

/** Cachorro companheiro invencível: segue o jogador e ataca monstros próximos. */
export function Dog({ blocks, onMobHit }: { blocks: Record<string, BlockType>; onMobHit: (id: string, dmg: number) => void }) {
  const root = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const phase = useRef(0);
  const moving = useRef(0);
  const biteCd = useRef(0);
  const t = useRef(0);
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    t.current += dt;
    biteCd.current = Math.max(0, biteCd.current - dt);
    const pos = g.position;
    const player = camera.position;

    // Teleporta se ficar muito longe
    if (pos.distanceTo(player) > 25) pos.set(player.x + 1.5, player.y, player.z + 1.5);

    // Procura o monstro mais próximo do jogador
    let targetId: string | null = null;
    let best = GUARD_RADIUS;
    mobRegistry.forEach((m, id) => {
      if (!m.hostile) return;
      const d = m.pos.distanceTo(player);
      if (d < best) { best = d; targetId = id; }
    });

    const goal = tmp.current;
    let speed = SPEED;
    let stopDist = 2;
    if (targetId) {
      goal.copy(mobRegistry.get(targetId)!.pos);
      speed = SPRINT;
      stopDist = 1;
    } else {
      // Fica ao lado do jogador
      goal.set(player.x + 1.5, pos.y, player.z + 1.5);
    }

    const dir = new THREE.Vector3(goal.x - pos.x, 0, goal.z - pos.z);
    const dist = dir.length();
    const walk = dist > stopDist;
    moving.current += ((walk ? (targetId ? 1.4 : 1) : 0) - moving.current) * (1 - Math.exp(-8 * dt));
    if (walk) {
      dir.normalize();
      const step = Math.min(dist - stopDist, speed * dt * (dist > 6 ? 1.4 : 1));
      pos.x += dir.x * step;
      pos.z += dir.z * step;
    }
    if (dist > 0.1) g.lookAt(goal.x, pos.y, goal.z);

    if (targetId && dist < 1.6 && biteCd.current <= 0) {
      onMobHit(targetId, BITE_DAMAGE);
      biteCd.current = 0.8;
    }

    pos.y = getGroundHeight(pos.x, pos.z, blocks);

    // Animação
    const m = moving.current;
    phase.current += dt * 12 * m;
    const swing = Math.sin(phase.current) * 0.7 * Math.min(m, 1);
    legs.current.forEach((l, i) => { if (l) l.rotation.x = swing * (i === 0 || i === 3 ? 1 : -1); });
    if (tail.current) tail.current.rotation.y = Math.sin(t.current * (targetId ? 6 : 14)) * 0.5;
    if (head.current) head.current.rotation.x = targetId && dist < 2 ? Math.sin(t.current * 20) * 0.25 : 0;
  });

  const legH = 0.4;
  const legP: [number, number, number][] = [[0.12, legH, 0.3], [-0.12, legH, 0.3], [0.12, legH, -0.3], [-0.12, legH, -0.3]];

  return (
    <group ref={root} position={[camera.position.x + 1.5, camera.position.y, camera.position.z + 1.5]}>
      {legP.map((p, i) => (
        <group key={i} position={p} ref={el => (legs.current[i] = el)}>
          <Box size={[0.13, legH, 0.13]} pos={[0, -legH / 2, 0]} color={FUR} />
        </group>
      ))}
      {/* Corpo + juba */}
      <Box size={[0.38, 0.38, 0.8]} pos={[0, legH + 0.19, -0.05]} color={FUR} />
      <Box size={[0.48, 0.45, 0.35]} pos={[0, legH + 0.24, 0.3]} color={DARK} />
      <Box size={[0.5, 0.08, 0.1]} pos={[0, legH + 0.3, 0.5]} color={COLLAR} />
      {/* Rabo */}
      <group ref={tail} position={[0, legH + 0.3, -0.45]} rotation={[0.6, 0, 0]}>
        <Box size={[0.12, 0.12, 0.4]} pos={[0, 0, -0.2]} color={DARK} />
      </group>
      {/* Cabeça */}
      <group ref={head} position={[0, legH + 0.4, 0.62]}>
        <Box size={[0.38, 0.35, 0.25]} color={FUR} />
        <Box size={[0.18, 0.15, 0.2]} pos={[0, -0.07, 0.22]} color={DARK} />
        <Box size={[0.07, 0.06, 0.02]} pos={[0, -0.02, 0.33]} color="#1a1a1a" />
        <Box size={[0.1, 0.12, 0.06]} pos={[0.12, 0.23, -0.03]} color={DARK} />
        <Box size={[0.1, 0.12, 0.06]} pos={[-0.12, 0.23, -0.03]} color={DARK} />
        <Box size={[0.06, 0.05, 0.01]} pos={[0.1, 0.06, 0.13]} color="#1a1a1a" />
        <Box size={[0.06, 0.05, 0.01]} pos={[-0.1, 0.06, 0.13]} color="#1a1a1a" />
      </group>
    </group>
  );
}
