import { useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
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
    // Show prompt initially
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
        camera={{ fov: 75, near: 0.1, far: 200 }}
        style={{ background: '#1a1a2e' }}
      >
        <Sky
          sunPosition={[100, 20, 100]}
          turbidity={8}
          rayleigh={2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
        <fog attach="fog" args={['#2a2a4a', 40, 100]} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={0.8}
          castShadow
        />
        <hemisphereLight intensity={0.3} color="#87CEEB" groundColor="#2d5a1e" />
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
