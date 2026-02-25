import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Cloud, Stars } from '@react-three/drei';
import { Terrain } from './Terrain';
import { Player } from './Player';
import { Fruits } from './Fruits';
import { MobsRenderer } from './MobsRenderer';
import { DayNightCycle } from './DayNightCycle';
import { RemotePlayersRenderer } from './RemotePlayersRenderer';
import { GameHUD } from './GameHUD';
import { CraftingUI } from './CraftingUI';
import { GameChat, ChatMessage } from './GameChat';
import { FruitType, BlockType, BLOCK_DROPS, MINING_REQUIREMENTS, TOOL_DAMAGE, ItemType } from './types';
import { MobData, spawnMobs } from './mobs';
import { SkinData } from './skins';
import { useMultiplayer } from './useMultiplayer';
import { useInventory } from './useInventory';
import { generateTerrain, generateFruits } from './terrainGenerator';

interface GameCanvasProps {
  skin: SkinData;
  multiplayer?: { roomCode: string; playerName: string };
}

export function GameCanvas({ skin, multiplayer }: GameCanvasProps) {
  const initialBlocks = useMemo(() => generateTerrain(32), []);
  const [blocks, setBlocks] = useState(initialBlocks);
  const initialFruits = useMemo(() => generateFruits(initialBlocks), [initialBlocks]);
  const [fruits, setFruits] = useState(initialFruits);
  const [score, setScore] = useState(0);
  const [collectedFruits, setCollectedFruits] = useState<FruitType[]>([]);
  const [blocksDestroyed, setBlocksDestroyed] = useState(0);
  const [locked, setLocked] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [isNight, setIsNight] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(0);
  const [mobs, setMobs] = useState<MobData[]>([]);
  const [mobsKilled, setMobsKilled] = useState(0);
  const [localChat, setLocalChat] = useState<ChatMessage[]>([]);

  const inventory = useInventory();

  const mp = useMultiplayer({
    roomCode: multiplayer?.roomCode || 'single',
    playerName: multiplayer?.playerName || 'Player',
    skin,
  });
  const isMultiplayer = !!multiplayer;
  const playerName = multiplayer?.playerName || 'Player';
  const wasNightRef = useRef(false);
  const spawnedRef = useRef(false);

  useEffect(() => {
    if (!spawnedRef.current) {
      setMobs(spawnMobs(blocks, false));
      spawnedRef.current = true;
    }
  }, [blocks]);

  const handleTimeChange = useCallback((time: number, night: boolean) => {
    setTimeOfDay(time);
    if (night !== wasNightRef.current) {
      wasNightRef.current = night;
      setIsNight(night);
      setMobs(spawnMobs(blocks, night));
    }
  }, [blocks]);

  useEffect(() => {
    const onLockChange = () => {
      const isLocked = !!document.pointerLockElement;
      setLocked(isLocked);
      const prompt = document.getElementById('pointer-lock-prompt');
      if (prompt) prompt.style.opacity = isLocked ? '0' : '1';
    };
    document.addEventListener('pointerlockchange', onLockChange);
    setTimeout(() => {
      const prompt = document.getElementById('pointer-lock-prompt');
      if (prompt) prompt.style.opacity = '1';
    }, 500);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Toggle crafting with E key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        inventory.setCraftingOpen(prev => !prev);
        // Release pointer lock when opening crafting
        if (!inventory.craftingOpen && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      // Hotbar selection with number keys
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const slot = parseInt(e.code.replace('Digit', '')) - 1;
        inventory.setSelectedSlot(slot);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inventory.craftingOpen]);

  const handleBlockBreak = useCallback((key: string) => {
    const blockType = blocks[key];
    if (!blockType) return;

    // Check mining requirements
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements) {
      const equipped = inventory.equippedItem;
      if (!equipped || !requirements.includes(equipped)) {
        return; // Can't mine this block
      }
    }

    // Collect drop
    inventory.collectBlock(blockType, inventory.equippedItem);

    setBlocks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setScore(s => s + 10);
    setBlocksDestroyed(d => d + 1);
  }, [blocks, inventory]);

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

  const handleMobHit = useCallback((id: string, damage: number) => {
    // Apply weapon damage bonus
    const weaponDamage = inventory.equippedItem ? (TOOL_DAMAGE[inventory.equippedItem] || 0) : 0;
    const totalDamage = damage + weaponDamage;

    setMobs(prev => prev.map(m => {
      if (m.id !== id) return m;
      const newHealth = m.health - totalDamage;
      if (newHealth <= 0) {
        setScore(s => s + (m.hostile ? 50 : 10));
        setMobsKilled(k => k + 1);
        return { ...m, health: 0, dead: true };
      }
      return { ...m, health: newHealth };
    }));
  }, [inventory.equippedItem]);

  const handlePlayerDamage = useCallback((damage: number) => {
    setPlayerHealth(prev => {
      const newHealth = Math.max(0, prev - damage);
      if (newHealth <= 0) {
        setTimeout(() => setPlayerHealth(100), 1500);
      }
      return newHealth;
    });
  }, []);

  return (
    <div className="relative w-full h-screen bg-background">
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.1, far: 250 }}
        style={{ background: isNight ? '#0a0a1a' : '#87CEEB' }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: isNight ? 0.6 : 1.1 }}
      >
        <Sky
          sunPosition={[
            Math.sin(timeOfDay * Math.PI * 2) * 100,
            Math.cos(timeOfDay * Math.PI * 2) * 80,
            60,
          ]}
          turbidity={isNight ? 20 : 3}
          rayleigh={isNight ? 0 : 0.5}
          mieCoefficient={0.003}
          mieDirectionalG={0.7}
        />
        {isNight && <Stars radius={100} depth={50} count={3000} factor={4} fade speed={1} />}
        {!isNight && (
          <>
            <Cloud opacity={0.4} speed={0.2} segments={20} position={[0, 30, -20]} />
            <Cloud opacity={0.3} speed={0.15} segments={15} position={[-30, 35, 10]} />
          </>
        )}
        <fog attach="fog" args={[isNight ? '#0a0a2a' : '#b0d4f1', isNight ? 20 : 60, isNight ? 70 : 140]} />

        <DayNightCycle onTimeChange={handleTimeChange} speed={0.000556} />

        <Terrain blocks={blocks} />
        <Fruits fruits={fruits} />
        <MobsRenderer
          mobs={mobs}
          blocks={blocks}
          onMobHit={handleMobHit}
          onPlayerDamage={handlePlayerDamage}
        />
        <Player
          blocks={blocks}
          fruits={fruits}
          mobs={mobs}
          skin={skin}
          onBlockBreak={handleBlockBreak}
          onFruitCollect={handleFruitCollect}
          onMobHit={handleMobHit}
          sendPosition={isMultiplayer ? mp.sendPosition : undefined}
          playerHealth={playerHealth}
          equippedItem={inventory.equippedItem}
        />
        {isMultiplayer && <RemotePlayersRenderer players={mp.remotePlayers} />}
      </Canvas>
      <GameHUD
        score={score}
        collectedFruits={collectedFruits}
        blocksDestroyed={blocksDestroyed}
        playerHealth={playerHealth}
        isNight={isNight}
        mobsKilled={mobsKilled}
        roomCode={multiplayer?.roomCode}
        playersOnline={isMultiplayer ? mp.remotePlayers.length + 1 : undefined}
        inventory={inventory}
      />
      {inventory.craftingOpen && (
        <CraftingUI
          items={inventory.items}
          canCraft={inventory.canCraft}
          onCraft={inventory.craft}
          onClose={() => inventory.setCraftingOpen(false)}
        />
      )}
      <GameChat
        playerName={playerName}
        messages={isMultiplayer ? mp.chatMessages : localChat}
        onSendMessage={isMultiplayer ? mp.sendChatMessage : (text) => {
          setLocalChat(prev => [...prev.slice(-49), {
            id: `local-${Date.now()}`,
            sender: playerName,
            text,
            timestamp: Date.now(),
          }]);
        }}
      />
    </div>
  );
}
