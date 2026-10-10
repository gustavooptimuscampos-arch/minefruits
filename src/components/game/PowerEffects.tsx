import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { powerEffects, PowerEffect } from './playerState';

const DURATION = 650; // ms
const COLORS: Record<PowerEffect['kind'], string> = {
  flame: '#ff5a1f',
  ice: '#7fe3ff',
  light: '#fff176',
  dark: '#7b1fa2',
  rubber: '#ff69b4',
};

/** Bolha que cresce e some: o "estouro" de cada poder. */
function Burst({ effect }: { effect: PowerEffect }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const k = Math.min(1, (performance.now() - effect.start) / DURATION);
    if (ref.current) ref.current.scale.setScalar(0.3 + k * effect.radius);
    if (mat.current) mat.current.opacity = 0.55 * (1 - k);
  });
  return (
    <mesh ref={ref} position={effect.pos}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshBasicMaterial
        ref={mat}
        color={COLORS[effect.kind]}
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={effect.kind === 'dark' ? THREE.NormalBlending : THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function PowerEffects() {
  const [list, setList] = useState<PowerEffect[]>([]);
  useFrame(() => {
    const now = performance.now();
    // Remove os que já terminaram
    for (let i = powerEffects.length - 1; i >= 0; i--) {
      if (now - powerEffects[i].start > DURATION) powerEffects.splice(i, 1);
    }
    if (powerEffects.length !== list.length || powerEffects.some((e, i) => e !== list[i])) setList([...powerEffects]);
  });
  return (
    <>
      {list.map(e => <Burst key={e.id} effect={e} />)}
    </>
  );
}
