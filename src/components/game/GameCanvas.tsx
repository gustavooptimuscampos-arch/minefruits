import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Player } from './Player';
import { Fruits } from './Fruits';
import { MobsRenderer } from './MobsRenderer';
import { Dog } from './Dog';
import { DayNightCycle } from './DayNightCycle';
import { Weather } from './Weather';
import { RemotePlayersRenderer } from './RemotePlayersRenderer';
import { GameHUD } from './GameHUD';
import { CraftingUI } from './CraftingUI';
import { GameChat, ChatMessage } from './GameChat';
import { FruitType, BlockType, BLOCK_DROPS, MINING_REQUIREMENTS, TOOL_DAMAGE, ItemType, GameCoin, AccessoryType, SHOP_ITEMS, FRUIT_CONFIG } from './types';
import { MobData, MobType, MOB_CONFIG, spawnMobs } from './mobs';
import { SkinData } from './skins';
import { useMultiplayer } from './useMultiplayer';
import { useInventory } from './useInventory';
import { generateTerrain, generateFruits, generateCoins } from './terrainGenerator';
import { CoinsRenderer } from './CoinsRenderer';
import { CoinShop } from './CoinShop';
import { MOB_POINTS, FRUIT_POINTS, FRUIT_HUNGER, ScoreEntry } from './scoring';
import { TouchControls } from './TouchControls';
import { isTouchDevice } from './touchInput';

interface GameCanvasProps {
  skin: SkinData;
  multiplayer?: { roomCode: string; playerName: string };
  onExit?: () => void;
}

export function GameCanvas({ skin, multiplayer, onExit }: GameCanvasProps) {
  const initialBlocks = useMemo(() => generateTerrain(20), []);
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
  const [pointerLocked, setLocked] = useState(false);
  // No celular não existe "travar o mouse": o jogo fica ativo direto.
  const locked = pointerLocked || isTouchDevice;
  const [playerHealth, setPlayerHealth] = useState(100);
  const [hunger, setHunger] = useState(100);
  const [isNight, setIsNight] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(0);
  const [mobs, setMobs] = useState<MobData[]>([]);
  const [mobsKilled, setMobsKilled] = useState(0);
  const [localChat, setLocalChat] = useState<ChatMessage[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [scoreLog, setScoreLog] = useState<ScoreEntry[]>([]);

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

  // Hunger decreases over time
  useEffect(() => {
    const interval = setInterval(() => {
      setHunger(prev => {
        const next = Math.max(0, prev - 0.5);
        if (next <= 0) {
          // Starving: lose health
          setPlayerHealth(h => Math.max(0, h - 1));
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
    const onLockChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onLockChange);
    onLockChange();
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Key bindings
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') {
        inventory.setCraftingOpen(prev => !prev);
        if (!inventory.craftingOpen && document.pointerLockElement) document.exitPointerLock();
      }
      if (e.code === 'KeyB') {
        setShopOpen(prev => !prev);
        if (!shopOpen && document.pointerLockElement) document.exitPointerLock();
      }
      if (e.code === 'KeyR') {
        setShowRanking(prev => !prev);
        if (document.pointerLockElement) document.exitPointerLock();
      }
      if (e.code === 'Escape' && !inventory.craftingOpen && !shopOpen && !showRanking) {
        if (onExit) onExit();
      }
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        inventory.setSelectedSlot(parseInt(e.code.replace('Digit', '')) - 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inventory.craftingOpen, shopOpen, showRanking, onExit]);

  const handleBlockBreak = useCallback((key: string) => {
    const blockType = blocks[key];
    if (!blockType) return;
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements) {
      const equipped = inventory.equippedItem;
      if (!equipped || !requirements.includes(equipped)) return;
    }
    inventory.collectBlock(blockType, inventory.equippedItem);
    setBlocks(prev => { const next = { ...prev }; delete next[key]; return next; });
    setScore(s => s + 10);
    setBlocksDestroyed(d => d + 1);
  }, [blocks, inventory]);

  const handleFruitCollect = useCallback((id: string) => {
    setFruits(prev => prev.map(f => f.id === id ? { ...f, collected: true } : f));
    const fruit = fruits.find(f => f.id === id);
    if (fruit && !fruit.collected) {
      const pts = FRUIT_POINTS[fruit.type];
      const hungerRestore = FRUIT_HUNGER[fruit.type];
      setCollectedFruits(prev => [...prev, fruit.type]);
      setScore(s => s + pts);
      setHunger(h => Math.min(100, h + hungerRestore));

      const config = FRUIT_CONFIG[fruit.type];
      setScoreLog(prev => {
        const existing = prev.find(e => e.type === 'fruit' && e.name === config.name);
        if (existing) return prev.map(e => e === existing ? { ...e, count: e.count + 1, points: e.points + pts } : e);
        return [...prev, { type: 'fruit', name: config.name, emoji: config.power.split(' ')[0], points: pts, count: 1 }];
      });
    }
  }, [fruits]);

  const handleMobHit = useCallback((id: string, damage: number) => {
    const weaponDamage = inventory.equippedItem ? (TOOL_DAMAGE[inventory.equippedItem] || 0) : 0;
    const totalDamage = damage + weaponDamage;

    setMobs(prev => prev.map(m => {
      if (m.id !== id) return m;
      const newHealth = m.health - totalDamage;
      if (newHealth <= 0) {
        const pts = MOB_POINTS[m.type];
        setScore(s => s + pts);
        setMobsKilled(k => k + 1);
        setVoxelCoins(c => c + (m.hostile ? 3 : 1));

        // Log to ranking
        const config = MOB_CONFIG[m.type];
        setScoreLog(prev => {
          const existing = prev.find(e => e.type === 'mob' && e.name === config.label);
          if (existing) return prev.map(e => e === existing ? { ...e, count: e.count + 1, points: e.points + pts } : e);
          return [...prev, { type: 'mob', name: config.label, emoji: config.label.split(' ')[0], points: pts, count: 1 }];
        });

        // Animals drop food (restore hunger)
        if (!m.hostile) {
          setHunger(h => Math.min(100, h + 15));
        }

        return { ...m, health: 0, dead: true };
      }
      return { ...m, health: newHealth };
    }));
  }, [inventory.equippedItem]);

  const handlePlayerDamage = useCallback((damage: number) => {
    if (!locked) return;
    setPlayerHealth(prev => {
      const newHealth = Math.max(0, prev - damage);
      if (newHealth <= 0) {
        setTimeout(() => { setPlayerHealth(100); setHunger(80); }, 1500);
      }
      return newHealth;
    });
  }, [locked]);

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

  const effectiveSkin = useMemo(() => {
    let s = { ...skin };
    const hatId = equippedItems['hat'];
    const capeId = equippedItems['cape'];
    const bodyId = equippedItems['body_color'];
    if (hatId) { const item = SHOP_ITEMS.find(i => i.id === hatId); if (item?.color) s = { ...s, hat: item.color }; }
    if (capeId) { const item = SHOP_ITEMS.find(i => i.id === capeId); if (item?.color) s = { ...s, cape: item.color }; }
    if (bodyId) { const item = SHOP_ITEMS.find(i => i.id === bodyId); if (item?.color) s = { ...s, head: item.color, body: item.color, arms: item.color, legs: item.color }; }
    return s;
  }, [skin, equippedItems]);

  const auraData = useMemo(() => {
    const auraId = equippedItems['aura'];
    if (!auraId) return null;
    const item = SHOP_ITEMS.find(i => i.id === auraId);
    return item ? { color: item.color!, emissive: item.emissive || item.color! } : null;
  }, [equippedItems]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden touch-none select-none" style={{ background: '#87CEEB', overscrollBehavior: 'none' }}>
      <Canvas
        shadows={false}
        camera={{ fov: 70, near: 0.1, far: 250, position: [0, 20, 0] }}
        style={{ background: '#87CEEB' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color('#7ec0ee');
          scene.fog = new THREE.Fog('#7ec0ee', 60, 170);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <DayNightCycle onTimeChange={handleTimeChange} speed={0.000556} />
        <Weather />
        <Terrain blocks={blocks} />
        <Fruits fruits={fruits} />
        <CoinsRenderer coins={coins} />
        <Dog blocks={blocks} onMobHit={handleMobHit} />
        <MobsRenderer mobs={mobs} blocks={blocks} onMobHit={handleMobHit} onPlayerDamage={handlePlayerDamage} />
        <Player
          blocks={blocks} fruits={fruits} mobs={mobs} coins={coins} skin={effectiveSkin}
          onBlockBreak={handleBlockBreak} onFruitCollect={handleFruitCollect} onCoinCollect={handleCoinCollect}
          onMobHit={handleMobHit} sendPosition={isMultiplayer ? mp.sendPosition : undefined}
          playerHealth={playerHealth} equippedItem={inventory.equippedItem}
        />
        {isMultiplayer && <RemotePlayersRenderer players={mp.remotePlayers} />}
      </Canvas>

      {isTouchDevice && <TouchControls onExit={onExit} />}

      <GameHUD
        score={score} collectedFruits={collectedFruits} blocksDestroyed={blocksDestroyed}
        playerHealth={playerHealth} hunger={hunger} isNight={isNight} mobsKilled={mobsKilled}
        roomCode={multiplayer?.roomCode}
        playersOnline={isMultiplayer ? mp.remotePlayers.length + 1 : undefined}
        inventory={inventory} voxelCoins={voxelCoins} locked={locked}
        onExit={onExit}
      />

      {inventory.craftingOpen && (
        <CraftingUI items={inventory.items} canCraft={inventory.canCraft} onCraft={inventory.craft} onClose={() => inventory.setCraftingOpen(false)} />
      )}

      <GameChat
        playerName={playerName}
        messages={isMultiplayer ? mp.chatMessages : localChat}
        onSendMessage={isMultiplayer ? mp.sendChatMessage : (text) => {
          setLocalChat(prev => [...prev.slice(-49), { id: `local-${Date.now()}`, sender: playerName, text, timestamp: Date.now() }]);
        }}
      />

      {shopOpen && (
        <CoinShop coins={voxelCoins} ownedItems={ownedItems} equippedItems={equippedItems}
          onClose={() => setShopOpen(false)} onPurchaseItem={handleShopPurchase}
          onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem}
        />
      )}

      {/* Ranking overlay */}
      {showRanking && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm" style={{ zIndex: 60 }}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-pixel text-lg text-primary">🏆 RANKING</h2>
              <button onClick={() => setShowRanking(false)} className="font-pixel text-xs px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80">
                R Fechar
              </button>
            </div>

            <div className="mb-4 text-center">
              <p className="font-pixel text-2xl text-secondary">{score}</p>
              <p className="text-xs font-game text-muted-foreground">PONTOS TOTAIS</p>
            </div>

            {scoreLog.length === 0 ? (
              <p className="text-sm font-game text-muted-foreground text-center">Nenhuma pontuação ainda. Mate mobs e colete frutas!</p>
            ) : (
              <>
                {/* Mobs section */}
                {scoreLog.filter(e => e.type === 'mob').length > 0 && (
                  <div className="mb-4">
                    <p className="font-game text-sm text-muted-foreground mb-2">💀 Mobs Eliminados</p>
                    {scoreLog.filter(e => e.type === 'mob').sort((a, b) => b.points - a.points).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg mb-1 border border-border/30">
                        <span className="text-sm font-game text-foreground">{entry.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-game text-muted-foreground">x{entry.count} </span>
                          <span className="text-sm font-pixel text-primary">+{entry.points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fruits section */}
                {scoreLog.filter(e => e.type === 'fruit').length > 0 && (
                  <div className="mb-4">
                    <p className="font-game text-sm text-muted-foreground mb-2">🍎 Frutas Coletadas</p>
                    {scoreLog.filter(e => e.type === 'fruit').sort((a, b) => b.points - a.points).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-muted/20 rounded-lg mb-1 border border-border/30">
                        <span className="text-sm font-game text-foreground">{entry.emoji} {entry.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-game text-muted-foreground">x{entry.count} </span>
                          <span className="text-sm font-pixel text-secondary">+{entry.points}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border/30">
              <p className="text-xs font-game text-muted-foreground text-center">
                🧟 Zumbi: 50pts • 💀 Esqueleto: 60pts • 🕷️ Aranha: 40pts
              </p>
              <p className="text-xs font-game text-muted-foreground text-center mt-1">
                🔥 Fogo: 200pts • ❄️ Gelo: 150pts • ⚡ Luz: 250pts • 🌑 Trevas: 300pts • 🩷 Borracha: 100pts
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
