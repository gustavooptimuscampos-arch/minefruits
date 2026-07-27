import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lightState } from './lightState';

interface DayNightCycleProps {
  onTimeChange: (time: number, isNight: boolean) => void;
  speed?: number;
}

const SKY_DAY = new THREE.Color('#7ec0ee');
const SKY_DUSK = new THREE.Color('#e9885a');
const SKY_NIGHT = new THREE.Color('#20304f');

const TINT_DAY = new THREE.Color('#ffffff');
const TINT_DUSK = new THREE.Color('#ffbe96');
const TINT_NIGHT = new THREE.Color('#8ea2c8');

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// time: 0 = noon, 0.5 = midnight
export function DayNightCycle({ onTimeChange, speed = 0.015 }: DayNightCycleProps) {
  const timeRef = useRef(0.08);
  const lastReport = useRef(-1);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);

  const starGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.05);
      const r = 200;
      pts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    timeRef.current = (timeRef.current + speed * dt) % 1;
    const t = timeRef.current;

    const sunAngle = t * Math.PI * 2;
    const elev = Math.cos(sunAngle);          // 1 = noon, -1 = midnight
    const sunX = Math.sin(sunAngle) * 140;
    const sunY = elev * 120;

    // 0 at night, 1 during full day
    const day = smoothstep(-0.15, 0.3, elev);
    // sunrise / sunset glow
    const golden = Math.exp(-Math.pow(elev / 0.28, 2));

    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, day).lerp(SKY_DUSK, golden * 0.75);
    const tint = TINT_NIGHT.clone().lerp(TINT_DAY, day).lerp(TINT_DUSK, golden * 0.6);
    // keep a brightness floor so the world stays readable at night
    const brightness = 0.62 + day * 0.38;
    tint.multiplyScalar(brightness);

    lightState.sky.copy(sky);
    lightState.tint.copy(tint);
    lightState.sunElevation = elev;
    lightState.dayFactor = day;

    if (sunRef.current) {
      sunRef.current.position.set(sunX, Math.max(sunY, 12), 40);
      sunRef.current.intensity = 0.5 + day * 0.9;
      sunRef.current.color.copy(tint);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.5 + day * 0.3;
      ambientRef.current.color.copy(sky).lerp(TINT_DAY, 0.4);
    }
    if (hemiRef.current) hemiRef.current.intensity = 0.35 + day * 0.45;

    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sunX, sunY, 40);
      sunMeshRef.current.visible = sunY > -20;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.set(-sunX, -sunY, -40);
      moonMeshRef.current.visible = -sunY > -20;
    }
    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - day * 1.4);
      starsRef.current.rotation.y = t * Math.PI * 2;
      starsRef.current.visible = mat.opacity > 0.02;
    }

    const scene = state.scene;
    if (scene.background instanceof THREE.Color) scene.background.copy(sky);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sky);
      scene.fog.near = 45 + day * 25;
      scene.fog.far = 130 + day * 60;
    }

    const isNight = elev < -0.05;
    if (lastReport.current !== (isNight ? 1 : 0) || Math.random() < 0.01) {
      lastReport.current = isNight ? 1 : 0;
      onTimeChange(t, isNight);
    }
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={[60, 90, 40]}
        intensity={1.2}
        color="#FFF5E1"
      />
      <ambientLight ref={ambientRef} intensity={0.6} color="#c4d7ed" />
      <hemisphereLight ref={hemiRef} intensity={0.5} color="#87CEEB" groundColor="#3d6b2e" />

      {/* Sun disc */}
      <mesh ref={sunMeshRef} position={[0, 120, 40]}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshBasicMaterial color="#fff6d5" fog={false} />
      </mesh>
      {/* Moon disc */}
      <mesh ref={moonMeshRef} position={[0, -120, -40]}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#dfe7f5" fog={false} />
      </mesh>
      {/* Stars */}
      <points ref={starsRef} geometry={starGeometry} frustumCulled={false}>
        <pointsMaterial size={1.4} color="#ffffff" transparent opacity={0} sizeAttenuation fog={false} />
      </points>
    </>
  );
}
