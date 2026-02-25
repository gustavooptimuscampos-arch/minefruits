import { useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Cloud } from '@react-three/drei';
import { Terrain } from './Terrain';
import { Player } from './Player';
import { Fruits } from './Fruits';
import { GameHUD } from './GameHUD';
import { FruitType } from './types';
import { generateTerrain, generateFruits } from './terrainGenerator';

export function GameCanvas() {
  const initialBlocks = useMemo(() => generateTerrain(32), []);
  const [blocks, setBlocks] = useState(initialBlocks);
  const initialFruits = useMemo(() => generateFruits(initialBlocks), [initialBlocks]);
  const [fruits, setFruits] = useState(initialFruits);
  const [score, setScore] = useState(0);
  const [collectedFruits, setCollectedFruits] = useState<FruitType[]>([]);
  const [blocksDestroyed, setBlocksDestroyed] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onLockChange = () => {
      const isLocked = !!document.pointerLockElement;
      setLocked(isLocked);
      const prompt = document.getElementById('pointer-lock-prompt');
      if (prompt) {
        prompt.style.opacity = isLocked ? '0' : '1';
      }
    };
    document.addEventListener('pointerlockchange', onLockChange);
    setTimeout(() => {
      const prompt = document.getElementById('pointer-lock-prompt');
      if (prompt) prompt.style.opacity = '1';
    }, 500);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  const handleBlockBreak = useCallback((key: string) => {
    setBlocks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setScore(s => s + 10);
    setBlocksDestroyed(d => d + 1);
  }, []);

  const handleFruitCollect = useCallback((id: string) => {
    setFruits(prev =>
      prev.map(f => f.id === id ? { ...f, collected: true } : f)
    );
    const fruit = fruits.find(f => f.id === id);
    if (fruit && !fruit.collected) {
      setCollectedFruits(prev => [...prev, fruit.type]);
      setScore(s => s + 100);
    }
  }, [fruits]);

  return (
    <div className="relative w-full h-screen bg-background">
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.1, far: 250 }}
        style={{ background: '#87CEEB' }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.1 }}
      >
        <Sky
          sunPosition={[100, 40, 60]}
          turbidity={3}
          rayleigh={0.5}
          mieCoefficient={0.003}
          mieDirectionalG={0.7}
        />
        <Cloud
          opacity={0.4}
          speed={0.2}
          segments={20}
          position={[0, 30, -20]}
        />
        <Cloud
          opacity={0.3}
          speed={0.15}
          segments={15}
          position={[-30, 35, 10]}
        />
        <fog attach="fog" args={['#b0d4f1', 60, 140]} />
        
        {/* Realistic lighting setup */}
        <ambientLight intensity={0.35} color="#c4d7ed" />
        <directionalLight
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
        <hemisphereLight intensity={0.4} color="#87CEEB" groundColor="#3d6b2e" />
        
        <Terrain blocks={blocks} />
        <Fruits fruits={fruits} />
        <Player
          blocks={blocks}
          fruits={fruits}
          onBlockBreak={handleBlockBreak}
          onFruitCollect={handleFruitCollect}
        />
      </Canvas>
      <GameHUD
        score={score}
        collectedFruits={collectedFruits}
        blocksDestroyed={blocksDestroyed}
      />
    </div>
  );
}
