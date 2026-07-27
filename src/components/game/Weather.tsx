import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lightState } from './lightState';

const RAIN_COUNT = 900;
const AREA = 60;

// Drifting volumetric-ish clouds + occasional rain
export function Weather() {
  const cloudsRef = useRef<THREE.Group>(null);
  const rainRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const wetness = useRef(0);

  const clouds = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; speed: number }[] = [];
    for (let i = 0; i < 26; i++) {
      list.push({
        pos: [
          (Math.random() - 0.5) * 220,
          38 + Math.random() * 18,
          (Math.random() - 0.5) * 220,
        ],
        scale: [10 + Math.random() * 22, 2 + Math.random() * 2.5, 8 + Math.random() * 16],
        speed: 0.4 + Math.random() * 0.6,
      });
    }
    return list;
  }, []);

  const rainGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * AREA;
      arr[i * 3 + 1] = Math.random() * 40;
      arr[i * 3 + 2] = (Math.random() - 0.5) * AREA;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = state.clock.elapsedTime;

    if (cloudsRef.current) {
      cloudsRef.current.children.forEach((child, i) => {
        child.position.x += clouds[i].speed * dt;
        if (child.position.x > 120) child.position.x = -120;
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.color.copy(lightState.tint).multiplyScalar(0.98);
      });
    }

    // Rain comes and goes on a slow cycle
    const target = Math.sin(t * 0.012) > 0.55 ? 1 : 0;
    wetness.current += (target - wetness.current) * dt * 0.5;

    if (rainRef.current && matRef.current) {
      const visible = wetness.current > 0.02;
      rainRef.current.visible = visible;
      matRef.current.opacity = wetness.current * 0.5;
      if (visible) {
        const cam = state.camera.position;
        rainRef.current.position.set(cam.x, 0, cam.z);
        const pos = rainGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < RAIN_COUNT; i++) {
          let y = pos.getY(i) - 34 * dt;
          if (y < 0) y = 38 + Math.random() * 4;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <group ref={cloudsRef}>
        {clouds.map((c, i) => (
          <mesh key={i} position={c.pos} scale={c.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        ))}
      </group>

      <points ref={rainRef} geometry={rainGeo} frustumCulled={false}>
        <pointsMaterial
          ref={matRef}
          color="#bcd4e6"
          size={0.13}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}
