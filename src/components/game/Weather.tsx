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

  // Nuvens em blocos, bem acima das montanhas (antes ficavam dentro delas), todas na mesma altura
  const CLOUD_Y = 84;
  const CLOUD_SPAN = 320;
  const clouds = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    for (let i = 0; i < 34; i++) {
      const cx = (Math.random() - 0.5) * CLOUD_SPAN, cz = (Math.random() - 0.5) * CLOUD_SPAN;
      // cada nuvem é feita de alguns blocões grudados
      const parts = 2 + Math.floor(Math.random() * 4);
      for (let j = 0; j < parts; j++) {
        list.push({
          pos: [cx + Math.round((Math.random() - 0.5) * 3) * 8, CLOUD_Y, cz + Math.round((Math.random() - 0.5) * 3) * 8],
          scale: [8 * (1 + Math.floor(Math.random() * 2)), 4, 8 * (1 + Math.floor(Math.random() * 2))],
        });
      }
    }
    return list;
  }, []);
  const cloudMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#9aa6b8'), transparent: true, opacity: 0.88, depthWrite: false }), []);
  const cloudGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

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
      // O vento leva as nuvens; elas dão a volta em torno do jogador
      const cam = state.camera.position;
      const half = CLOUD_SPAN / 2;
      cloudsRef.current.children.forEach(child => {
        child.position.x += 1.2 * dt;
        if (child.position.x - cam.x > half) child.position.x -= CLOUD_SPAN;
        if (child.position.x - cam.x < -half) child.position.x += CLOUD_SPAN;
        if (child.position.z - cam.z > half) child.position.z -= CLOUD_SPAN;
        if (child.position.z - cam.z < -half) child.position.z += CLOUD_SPAN;
      });
      // de noite as nuvens não brilham
      cloudMat.emissive.setRGB(0.6, 0.65, 0.72).multiplyScalar(0.15 + lightState.dayFactor * 0.5);
      // chuva: nuvens mais escuras
      cloudMat.color.setScalar(1 - wetness.current * 0.45);
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
        // a chuva cai em volta do jogador, na altura dele (antes caía embaixo do chão)
        rainRef.current.position.set(cam.x, cam.y - 18, cam.z);
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
          <mesh key={i} position={c.pos} scale={c.scale} geometry={cloudGeo} material={cloudMat} />
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
