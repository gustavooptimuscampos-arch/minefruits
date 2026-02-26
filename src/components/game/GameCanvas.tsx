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
import { FruitType, BlockType, BLOCK_DROPS, MINING_REQUIREMENTS, TOOL_DAMAGE, ItemType, GameCoin, AccessoryType, SHOP_ITEMS } from './types';
import { MobData, spawnMobs } from './mobs';
import { SkinData } from './skins';
import { useMultiplayer } from './useMultiplayer';
import { useInventory } from './useInventory';
import { generateTerrain, generateFruits, generateCoins } from './terrainGenerator';
import { CoinsRenderer } from './CoinsRenderer';
import { CoinShop } from './CoinShop';

interface GameCanvasProps {
  skin: SkinData;
  multiplayer?: { roomCode: string; playerName: string };
}

export function GameCanvas({ skin, multiplayer }: GameCanvasProps) {
  const initialBlocks = useMemo(() => generateTerrain(32), []);
  const [blocks, setBlocks] = useState(initialBlocks);
  const initialFruits = useMemo(() => generateFruits(initialBlocks), [initialBlocks]);
  const [fruits, setFruits] = useState(initialFruits);
  const initialCoins = useMemo(() => generateCoins(initialBlocks), [initialBlocks]);
  const [coins, setCoins] = useState(initialCoins);
  const [voxelCoins, setVoxelCoins] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<Record<string, string | null>>({});
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
      setLocked(!!document.pointerLockElement);
    };

    document.addEventListener('pointerlockchange', onLockChange);
    onLockChange();

    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Toggle crafting with E key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        inventory.setCraftingOpen(prev => !prev);
        if (!inventory.craftingOpen && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      if (e.code === 'KeyB') {
        setShopOpen(prev => !prev);
        if (!shopOpen && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
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
        setVoxelCoins(c => c + (m.hostile ? 3 : 1));
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

  const handleCoinCollect = useCallback((id: string) => {
    const coin = coins.find(c => c.id === id);
    if (coin && !coin.collected) {
      setCoins(prev => prev.map(c => c.id === id ? { ...c, collected: true } : c));
      setVoxelCoins(v => v + coin.value);
      setScore(s => s + coin.value * 10);
    }
  }, [coins]);

  const handleShopPurchase = useCallback((itemId: string, cost: number): boolean => {
    if (voxelCoins < cost) return false;
    setVoxelCoins(v => v - cost);
    setOwnedItems(prev => [...prev, itemId]);
    // Auto-equip on purchase
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item && ['hat', 'cape', 'aura', 'body_color'].includes(item.type)) {
      setEquippedItems(prev => ({ ...prev, [item.type]: itemId }));
    }
    return true;
  }, [voxelCoins]);

  const handleEquipItem = useCallback((itemId: string) => {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item) setEquippedItems(prev => ({ ...prev, [item.type]: itemId }));
  }, []);

  const handleUnequipItem = useCallback((type: AccessoryType) => {
    setEquippedItems(prev => ({ ...prev, [type]: null }));
  }, []);

  // Build effective skin with equipped accessories
  const effectiveSkin = useMemo(() => {
    let s = { ...skin };
    const hatId = equippedItems['hat'];
    const capeId = equippedItems['cape'];
    const bodyId = equippedItems['body_color'];
    if (hatId) {
      const item = SHOP_ITEMS.find(i => i.id === hatId);
      if (item?.color) s = { ...s, hat: item.color };
    }
    if (capeId) {
      const item = SHOP_ITEMS.find(i => i.id === capeId);
      if (item?.color) s = { ...s, cape: item.color };
    }
    if (bodyId) {
      const item = SHOP_ITEMS.find(i => i.id === bodyId);
      if (item?.color) s = { ...s, head: item.color, body: item.color, arms: item.color, legs: item.color };
    }
    return s;
  }, [skin, equippedItems]);

  // Get aura data for player model
  const auraData = useMemo(() => {
    const auraId = equippedItems['aura'];
    if (!auraId) return null;
    const item = SHOP_ITEMS.find(i => i.id === auraId);
    return item ? { color: item.color!, emissive: item.emissive || item.color! } : null;
  }, [equippedItems]);

  return (
    <div className="relative w-full h-screen bg-background">
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.1, far: 250 }}
        style={{ background: isNight ? '#1a2338' : '#87CEEB' }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: isNight ? 0.95 : 1.1 }}
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
        <CoinsRenderer coins={coins} />
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
          coins={coins}
          skin={effectiveSkin}
          onBlockBreak={handleBlockBreak}
          onFruitCollect={handleFruitCollect}
          onCoinCollect={handleCoinCollect}
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
        voxelCoins={voxelCoins}
        locked={locked}
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
      {shopOpen && (
        <CoinShop
          coins={voxelCoins}
          ownedItems={ownedItems}
          equippedItems={equippedItems}
          onClose={() => setShopOpen(false)}
          onPurchaseItem={handleShopPurchase}
          onEquipItem={handleEquipItem}
          onUnequipItem={handleUnequipItem}
        />
      )}
    </div>
  );
}
