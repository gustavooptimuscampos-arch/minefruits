import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from '@/components/game/Terrain';
import { DayNightCycle } from '@/components/game/DayNightCycle';
import { Weather } from '@/components/game/Weather';
import { generateTerrain } from '@/components/game/terrainGenerator';

export default function T() {
  const blocks = useMemo(() => generateTerrain(20), []);
  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ fov: 60, near: 0.1, far: 400, position: [26, 20, 26] }}
        onCreated={({ scene, camera, gl }) => {
          scene.background = new THREE.Color('#7ec0ee');
          scene.fog = new THREE.Fog('#7ec0ee', 60, 200);
          camera.lookAt(0, 4, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <DayNightCycle onTimeChange={() => {}} speed={0.02} />
        <Weather />
        <Terrain blocks={blocks} />
      </Canvas>
    </div>
  );
}
