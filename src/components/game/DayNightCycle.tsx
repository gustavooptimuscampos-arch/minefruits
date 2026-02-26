import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DayNightCycleProps {
  onTimeChange: (time: number, isNight: boolean) => void;
  speed?: number;
}

// time: 0=noon, 0.5=midnight, 1=noon again
export function DayNightCycle({ onTimeChange, speed = 0.015 }: DayNightCycleProps) {
  const timeRef = useRef(0.05); // Start early morning
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    timeRef.current = (timeRef.current + speed * dt) % 1;
    const t = timeRef.current;

    // Sun angle (0=noon overhead, 0.5=below horizon)
    const sunAngle = t * Math.PI * 2;
    const sunY = Math.cos(sunAngle) * 80;
    const sunX = Math.sin(sunAngle) * 100;

    if (sunRef.current) {
      sunRef.current.position.set(sunX, Math.max(sunY, -20), 40);
      
      // Sun intensity based on height
      const dayFactor = Math.max(0, Math.min(1, (sunY + 10) / 90));
      sunRef.current.intensity = dayFactor * 1.6;
      
      // Sunset/sunrise color
      if (dayFactor < 0.4 && dayFactor > 0) {
        sunRef.current.color.setHSL(0.06, 0.9, 0.6); // Orange
      } else {
        sunRef.current.color.setHSL(0.1, 0.2, 0.95); // Warm white
      }
    }

    if (ambientRef.current) {
      const isNight = sunY < 0;
      ambientRef.current.intensity = isNight ? 0.2 : 0.35;
      ambientRef.current.color.setHSL(isNight ? 0.62 : 0.6, isNight ? 0.25 : 0.2, isNight ? 0.45 : 0.8);
    }

    if (hemiRef.current) {
      const isNight = sunY < 0;
      hemiRef.current.intensity = isNight ? 0.1 : 0.4;
    }

    // Update fog
    const scene = state.scene;
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      const isNight = sunY < 0;
      const dayFactor = Math.max(0, Math.min(1, (sunY + 10) / 90));
      if (isNight) {
        scene.fog.color.setHSL(0.65, 0.3, 0.08);
        scene.fog.near = 20;
        scene.fog.far = 70;
      } else {
        scene.fog.color.setHSL(0.58, 0.3, 0.65 + dayFactor * 0.2);
        scene.fog.near = 60;
        scene.fog.far = 140;
      }
    }

    const isNight = sunY < 0;
    onTimeChange(t, isNight);
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={[60, 80, 40]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.001}
        color="#FFF5E1"
      />
      <ambientLight ref={ambientRef} intensity={0.35} color="#c4d7ed" />
      <hemisphereLight ref={hemiRef} intensity={0.4} color="#87CEEB" groundColor="#3d6b2e" />
    </>
  );
}
