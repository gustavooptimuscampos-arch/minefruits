import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lightState } from './lightState';
import { playerPosition } from './playerState';

interface DayNightCycleProps {
  onTimeChange: (time: number, isNight: boolean) => void;
  speed?: number;
  /** Hora inicial (0 = meio-dia, 0.5 = meia-noite), para continuar um jogo salvo. */
  initialTime?: number;
  /** Qualidade alta: o sol projeta sombras de verdade. */
  shadows?: boolean;
}

// Céu em degradê: topo, horizonte e o brilho em volta do sol
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // sempre no fundo
}`;
const SKY_FRAG = `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 sunDir;
uniform vec3 sunGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
  if (h < 0.0) col = mix(horizon, horizon * 0.75, min(-h * 3.0, 1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunGlow * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const TOP_DAY = new THREE.Color('#3f86d6');
const TOP_NIGHT = new THREE.Color('#0b1430');
const HORIZON_DAY = new THREE.Color('#a9d3f5');
const HORIZON_DUSK = new THREE.Color('#f29a5c');
const HORIZON_NIGHT = new THREE.Color('#1c2a4a');
const SUN_LIGHT = new THREE.Color('#fff1d6');
const DUSK_LIGHT = new THREE.Color('#ffb070');
const MOON_LIGHT = new THREE.Color('#9fb4ff');
/** Tamanho da área com sombra em volta do jogador. */
const SHADOW_HALF = 44;
const SHADOW_MAP = 2048;


const TINT_DAY = new THREE.Color('#ffffff');
const TINT_DUSK = new THREE.Color('#ffbe96');
const TINT_NIGHT = new THREE.Color('#8ea2c8');

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// time: 0 = noon, 0.5 = midnight
export function DayNightCycle({ onTimeChange, speed = 0.015, initialTime = 0.08, shadows = false }: DayNightCycleProps) {
  const timeRef = useRef(initialTime);
  const lastReport = useRef(-1);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const skyGroup = useRef<THREE.Group>(null);
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      top: { value: TOP_DAY.clone() },
      horizon: { value: HORIZON_DAY.clone() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunGlow: { value: new THREE.Color('#ffe2a8') },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  }), []);
  const sunDir = useMemo(() => new THREE.Vector3(), []);

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

    // 0 at night, 1 during full day
    const day = smoothstep(-0.15, 0.3, elev);
    // sunrise / sunset glow
    const golden = Math.exp(-Math.pow(elev / 0.28, 2));

    const tint = TINT_NIGHT.clone().lerp(TINT_DAY, day).lerp(TINT_DUSK, golden * 0.6);
    // keep a brightness floor so the world stays readable at night
    const brightness = 0.62 + day * 0.38;
    tint.multiplyScalar(brightness);

    // Cores do céu (topo e horizonte) e da neblina, que é a cor do horizonte
    const horizon = HORIZON_NIGHT.clone().lerp(HORIZON_DAY, day).lerp(HORIZON_DUSK, golden * 0.8);
    const top = TOP_NIGHT.clone().lerp(TOP_DAY, day);

    lightState.sky.copy(horizon);
    lightState.tint.copy(tint);
    lightState.sunElevation = elev;
    lightState.dayFactor = day;

    // Céu, sol, lua e estrelas acompanham a câmera (ficam sempre "no infinito")
    const cam = state.camera.position;
    sunDir.set(Math.sin(sunAngle), elev, 0.32).normalize();
    if (skyGroup.current) skyGroup.current.position.copy(cam);
    skyMat.uniforms.top.value.copy(top);
    skyMat.uniforms.horizon.value.copy(horizon);
    skyMat.uniforms.sunDir.value.copy(elev > -0.2 ? sunDir : sunDir.clone().negate());
    skyMat.uniforms.sunGlow.value.copy(elev > -0.2 ? SUN_LIGHT.clone().lerp(DUSK_LIGHT, golden) : MOON_LIGHT).multiplyScalar(elev > -0.2 ? 1 : 0.25);

    // Luz: de dia o sol, de noite a lua (azulada e fraca). A sombra segue o jogador.
    if (sunRef.current) {
      const sun = sunRef.current;
      const isDayLight = elev > -0.08;
      const lightDir = isDayLight ? sunDir : sunDir.clone().negate();
      // sol muito baixo deixa sombras compridas demais: limita a altura mínima
      const dir = lightDir.clone(); dir.y = Math.max(dir.y, 0.28); dir.normalize();
      // anda em "degraus" do tamanho de um pixel da sombra: a sombra não treme quando o jogador anda
      const step = (SHADOW_HALF * 2) / SHADOW_MAP;
      const px = Math.round(playerPosition.x / step) * step, pz = Math.round(playerPosition.z / step) * step;
      sun.target.position.set(px, playerPosition.y - 4, pz);
      sun.position.set(px + dir.x * 100, playerPosition.y - 4 + dir.y * 100, pz + dir.z * 100);
      sun.target.updateMatrixWorld();
      const dayK = isDayLight ? (0.25 + day * 0.75) : 0.35;
      sun.intensity = (isDayLight ? 2.4 : 0.55) * dayK;
      sun.color.copy(isDayLight ? SUN_LIGHT.clone().lerp(DUSK_LIGHT, golden * 0.85) : MOON_LIGHT);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.35 + day * 0.35;
      ambientRef.current.color.copy(horizon).lerp(TINT_DAY, 0.5);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.45 + day * 0.75;
      hemiRef.current.color.copy(top).lerp(TINT_DAY, 0.3);
    }

    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunDir).multiplyScalar(190);
      sunMeshRef.current.lookAt(cam);
      sunMeshRef.current.visible = elev > -0.2;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.copy(sunDir).multiplyScalar(-190);
      moonMeshRef.current.lookAt(cam);
      moonMeshRef.current.visible = elev < 0.2;
    }
    if (starsRef.current) {
      const mat = starsRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - day * 1.4);
      starsRef.current.rotation.y = t * Math.PI * 2;
      starsRef.current.visible = mat.opacity > 0.02;
    }

    const scene = state.scene;
    if (scene.background instanceof THREE.Color) scene.background.copy(horizon);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(horizon);
      scene.fog.near = 50 + day * 30;
      scene.fog.far = 150 + day * 60;
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
        castShadow={shadows}
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={240}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
      <ambientLight ref={ambientRef} intensity={0.6} color="#c4d7ed" />
      <hemisphereLight ref={hemiRef} intensity={0.5} color="#87CEEB" groundColor="#4a5a3a" />

      <group ref={skyGroup}>
        {/* Céu em degradê */}
        <mesh material={skyMat} renderOrder={-1} frustumCulled={false}>
          <sphereGeometry args={[210, 32, 16]} />
        </mesh>
        {/* Sol (quadrado, estilo Minecraft) */}
        <mesh ref={sunMeshRef}>
          <boxGeometry args={[16, 16, 1]} />
          <meshBasicMaterial color="#fff3c4" fog={false} toneMapped={false} />
        </mesh>
        {/* Lua */}
        <mesh ref={moonMeshRef}>
          <boxGeometry args={[10, 10, 1]} />
          <meshBasicMaterial color="#e6ecf7" fog={false} />
        </mesh>
        {/* Estrelas */}
        <points ref={starsRef} geometry={starGeometry} frustumCulled={false}>
          <pointsMaterial size={1.4} color="#ffffff" transparent opacity={0} sizeAttenuation fog={false} />
        </points>
      </group>
    </>
  );
}
