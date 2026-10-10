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
import { FruitType, MINING_REQUIREMENTS, TOOL_DAMAGE, ITEM_CONFIG, AccessoryType, SHOP_ITEMS, FRUIT_CONFIG, Fruit, GameCoin } from './types';
import { MobData, MOB_CONFIG, spawnMobs } from './mobs';
import { SkinData } from './skins';
import { useMultiplayer } from './useMultiplayer';
import { useInventory } from './useInventory';
import { generateTerrain, generateFruits, generateCoins } from './terrainGenerator';
import { CoinsRenderer } from './CoinsRenderer';
import { CoinShop } from './CoinShop';
import { MOB_POINTS, FRUIT_POINTS, FRUIT_HUNGER, ScoreEntry } from './scoring';
import { TouchControls } from './TouchControls';
import { isTouchDevice } from './touchInput';
import { isTypingTarget } from './keyboard';

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
  const [mobs, setMobs] = useState<MobData[]>([]);
  const [mobsKilled, setMobsKilled] = useState(0);
  const [localChat, setLocalChat] = useState<ChatMessage[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [scoreLog, setScoreLog] = useState<ScoreEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dead, setDead] = useState(false);
  const [respawnKey, setRespawnKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const inventory = useInventory();
  const { craftingOpen, setCraftingOpen, setSelectedSlot, equippedItem, collectBlock } = inventory;

  const isMultiplayer = !!multiplayer;
  const mp = useMultiplayer({
    roomCode: multiplayer?.roomCode || 'single',
    playerName: multiplayer?.playerName || 'Player',
    skin,
    enabled: isMultiplayer,
  });
  const playerName = multiplayer?.playerName || 'Player';
  const wasNightRef = useRef(false);
  const spawnedRef = useRef(false);

  // Fonte da verdade síncrona: vários acertos/coletas podem acontecer no mesmo frame,
  // antes do React renderizar. Sem isso, um mob morto dava pontos duas vezes.
  const mobsRef = useRef<MobData[]>([]);
  const fruitsRef = useRef<Fruit[]>(fruits);
  const coinsRef = useRef<GameCoin[]>(coins);
  const deadRef = useRef(false);
  const expectUnlockRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const respawnTimer = useRef<ReturnType<typeof setTimeout>>();

  const anyOverlay = craftingOpen || shopOpen || showRanking || chatOpen || paused || dead;
  const overlayRef = useRef({ craftingOpen, shopOpen, showRanking, chatOpen, paused, dead });
  overlayRef.current = { craftingOpen, shopOpen, showRanking, chatOpen, paused, dead };

  const applyMobs = useCallback((next: MobData[]) => {
    mobsRef.current = next;
    setMobs(next);
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  }, []);

  /** Solta o mouse para mexer num menu, sem que isso abra a pausa. */
  const releasePointer = useCallback(() => {
    if (document.pointerLockElement) {
      expectUnlockRef.current = true;
      document.exitPointerLock();
    }
  }, []);

  const resumeGame = useCallback(() => {
    setPaused(false);
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas canvas');
    // Em navegadores novos requestPointerLock devolve uma Promise que pode ser recusada
    // (ex.: logo depois do ESC). Nesse caso o jogador só clica no jogo para continuar.
    try {
      const r = canvas?.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {});
    } catch { /* idem */ }
  }, []);

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    clearTimeout(respawnTimer.current);
  }, []);

  // A fome diminui com o tempo (pausa junto com o jogo)
  useEffect(() => {
    if (paused || dead) return;
    const interval = setInterval(() => {
      setHunger(prev => Math.max(0, prev - 0.5));
    }, 2000);
    return () => clearInterval(interval);
  }, [paused, dead]);

  // Passando fome: perde vida
  useEffect(() => {
    if (hunger > 0 || paused || dead) return;
    const interval = setInterval(() => setPlayerHealth(h => Math.max(0, h - 1)), 2000);
    return () => clearInterval(interval);
  }, [hunger, paused, dead]);

  // Morte (por monstro OU por fome) → tela de morte → renasce no ponto inicial
  useEffect(() => {
    if (playerHealth > 0 || deadRef.current) return;
    deadRef.current = true;
    setDead(true);
    setCraftingOpen(false);
    setShopOpen(false);
    setShowRanking(false);
    releasePointer();
    respawnTimer.current = setTimeout(() => {
      deadRef.current = false;
      setPlayerHealth(100);
      setHunger(h => Math.max(h, 80));
      setRespawnKey(k => k + 1);
      setDead(false);
    }, 1500);
  }, [playerHealth, releasePointer, setCraftingOpen]);

  useEffect(() => {
    if (!spawnedRef.current) {
      applyMobs(spawnMobs(blocks, false));
      spawnedRef.current = true;
    }
  }, [blocks, applyMobs]);

  const handleTimeChange = useCallback((_time: number, night: boolean) => {
    if (night !== wasNightRef.current) {
      wasNightRef.current = night;
      setIsNight(night);
      applyMobs(spawnMobs(blocks, night));
    }
  }, [blocks, applyMobs]);

  // Se o mouse foi solto sem ser por um menu (ex.: ESC), abre a pausa
  useEffect(() => {
    let wasLocked = !!document.pointerLockElement;
    const onLockChange = () => {
      const isLocked = !!document.pointerLockElement;
      setLocked(isLocked);
      const justUnlocked = wasLocked && !isLocked;
      wasLocked = isLocked;
      if (!justUnlocked) return; // só pausa quando o mouse estava preso e foi solto
      if (expectUnlockRef.current) { expectUnlockRef.current = false; return; }
      const o = overlayRef.current;
      if (!o.craftingOpen && !o.shopOpen && !o.showRanking && !o.chatOpen && !o.dead) setPaused(true);
    };
    document.addEventListener('pointerlockchange', onLockChange);
    onLockChange();
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Atalhos do jogo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return; // digitando no chat
      const o = overlayRef.current;

      if (e.code === 'Escape') {
        // ESC fecha o que estiver aberto por cima; sem nada aberto, pausa (não sai direto)
        if (o.paused) resumeGame();
        else if (o.shopOpen) setShopOpen(false);
        else if (o.craftingOpen) setCraftingOpen(false);
        else if (o.showRanking) setShowRanking(false);
        else if (o.chatOpen || o.dead) return; // o chat trata o próprio ESC
        else { releasePointer(); setPaused(true); }
        return;
      }
      if (o.paused || o.dead || o.chatOpen) return;

      if (e.code === 'KeyE') {
        setShopOpen(false); setShowRanking(false);
        setCraftingOpen(prev => !prev);
        releasePointer();
      }
      if (e.code === 'KeyB') {
        setCraftingOpen(false); setShowRanking(false);
        setShopOpen(prev => !prev);
        releasePointer();
      }
      if (e.code === 'KeyR') {
        setCraftingOpen(false); setShopOpen(false);
        setShowRanking(prev => !prev);
        releasePointer();
      }
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        setSelectedSlot(parseInt(e.code.replace('Digit', '')) - 1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setCraftingOpen, setSelectedSlot, releasePointer, resumeGame]);

  const handleChatOpenChange = useCallback((open: boolean) => {
    setChatOpen(open);
    if (open) releasePointer();
  }, [releasePointer]);

  const handleBlockBreak = useCallback((key: string) => {
    const blockType = blocks[key];
    if (!blockType) return;
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements && (!equippedItem || !requirements.includes(equippedItem))) {
      // Antes não acontecia nada e parecia bug: agora o jogador sabe o que falta
      showNotice(`⛏️ Precisa de ${ITEM_CONFIG[requirements[0]].label} ou melhor`);
      return;
    }
    collectBlock(blockType, equippedItem);
    setBlocks(prev => { const next = { ...prev }; delete next[key]; return next; });
    setScore(s => s + 10);
    setBlocksDestroyed(d => d + 1);
  }, [blocks, equippedItem, collectBlock, showNotice]);

  const handleFruitCollect = useCallback((id: string) => {
    const fruit = fruitsRef.current.find(f => f.id === id);
    if (!fruit || fruit.collected) return;
    fruitsRef.current = fruitsRef.current.map(f => f.id === id ? { ...f, collected: true } : f);
    setFruits(fruitsRef.current);

    const pts = FRUIT_POINTS[fruit.type];
    const config = FRUIT_CONFIG[fruit.type];
    setCollectedFruits(prev => [...prev, fruit.type]);
    setScore(s => s + pts);
    setHunger(h => Math.min(100, h + FRUIT_HUNGER[fruit.type]));
    setScoreLog(prev => {
      const existing = prev.find(e => e.type === 'fruit' && e.name === config.name);
      if (existing) return prev.map(e => e === existing ? { ...e, count: e.count + 1, points: e.points + pts } : e);
      return [...prev, { type: 'fruit', name: config.name, emoji: config.power.split(' ')[0], points: pts, count: 1 }];
    });
  }, []);

  /** Dano em mob. Usado pelo jogador e pelo cachorro. */
  const handleMobHit = useCallback((id: string, damage: number) => {
    const mob = mobsRef.current.find(m => m.id === id);
    if (!mob || mob.dead) return; // mob já morto não dá pontos de novo
    const newHealth = mob.health - damage;

    if (newHealth > 0) {
      applyMobs(mobsRef.current.map(m => m.id === id ? { ...m, health: newHealth } : m));
      return;
    }

    applyMobs(mobsRef.current.map(m => m.id === id ? { ...m, health: 0, dead: true } : m));
    const pts = MOB_POINTS[mob.type];
    const config = MOB_CONFIG[mob.type];
    setScore(s => s + pts);
    setMobsKilled(k => k + 1);
    setVoxelCoins(c => c + (mob.hostile ? 3 : 1));
    setScoreLog(prev => {
      const existing = prev.find(e => e.type === 'mob' && e.name === config.label);
      if (existing) return prev.map(e => e === existing ? { ...e, count: e.count + 1, points: e.points + pts } : e);
      return [...prev, { type: 'mob', name: config.label, emoji: config.label.split(' ')[0], points: pts, count: 1 }];
    });
    // Animais deixam comida (recupera fome)
    if (!mob.hostile) setHunger(h => Math.min(100, h + 15));
  }, [applyMobs]);

  /** Ataque do jogador: soma o dano da arma equipada (o cachorro não ganha esse bônus). */
  const handlePlayerAttack = useCallback((id: string, damage: number) => {
    const weaponDamage = equippedItem ? (TOOL_DAMAGE[equippedItem] || 0) : 0;
    handleMobHit(id, damage + weaponDamage);
  }, [equippedItem, handleMobHit]);

  const handlePlayerDamage = useCallback((damage: number) => {
    if (!locked || deadRef.current) return;
    setPlayerHealth(prev => Math.max(0, prev - damage));
  }, [locked]);

  const handleCoinCollect = useCallback((id: string) => {
    const coin = coinsRef.current.find(c => c.id === id);
    if (!coin || coin.collected) return;
    coinsRef.current = coinsRef.current.map(c => c.id === id ? { ...c, collected: true } : c);
    setCoins(coinsRef.current);
    setVoxelCoins(v => v + coin.value);
    setScore(s => s + coin.value * 10);
  }, []);

  const handleShopPurchase = useCallback((itemId: string, cost: number): boolean => {
    if (voxelCoins < cost || ownedItems.includes(itemId)) return false;
    setVoxelCoins(v => v - cost);
    setOwnedItems(prev => [...prev, itemId]);
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (item && ['hat', 'cape', 'aura', 'body_color'].includes(item.type)) {
      setEquippedItems(prev => ({ ...prev, [item.type]: itemId }));
    }
    return true;
  }, [voxelCoins, ownedItems]);

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

  // Aura comprada na loja (antes era calculada mas nunca desenhada)
  const auraData = useMemo(() => {
    const auraId = equippedItems['aura'];
    if (!auraId) return null;
    const item = SHOP_ITEMS.find(i => i.id === auraId);
    return item?.color ? { color: item.color, emissive: item.emissive || item.color } : null;
  }, [equippedItems]);

  return (
    <div id="game-canvas" className="relative w-full h-[100dvh] overflow-hidden touch-none select-none" style={{ background: '#87CEEB', overscrollBehavior: 'none' }}>
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
        <MobsRenderer mobs={mobs} blocks={blocks} onPlayerDamage={handlePlayerDamage} />
        <Player
          blocks={blocks} fruits={fruits} mobs={mobs} coins={coins} skin={effectiveSkin}
          onBlockBreak={handleBlockBreak} onFruitCollect={handleFruitCollect} onCoinCollect={handleCoinCollect}
          onMobHit={handlePlayerAttack} sendPosition={isMultiplayer ? mp.sendPosition : undefined}
          playerHealth={playerHealth} equippedItem={equippedItem}
          controlsEnabled={!anyOverlay} respawnKey={respawnKey} aura={auraData}
        />
        {isMultiplayer && <RemotePlayersRenderer players={mp.remotePlayers} />}
      </Canvas>

      {/* No celular, "Sair" abre a pausa (com Continuar / Sair), igual ao ESC no computador */}
      {isTouchDevice && !dead && <TouchControls onExit={() => setPaused(true)} />}

      <GameHUD
        score={score} collectedFruits={collectedFruits} blocksDestroyed={blocksDestroyed}
        playerHealth={playerHealth} hunger={hunger} isNight={isNight} mobsKilled={mobsKilled}
        roomCode={multiplayer?.roomCode}
        playersOnline={isMultiplayer ? mp.remotePlayers.length + 1 : undefined}
        inventory={inventory} voxelCoins={voxelCoins} locked={locked || anyOverlay}
        totalFruits={fruits.length}
        onPause={() => { releasePointer(); setPaused(true); }}
      />

      {notice && (
        <div className="absolute top-[58%] left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 12 }}>
          <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
            <span className="text-xs font-game text-foreground">{notice}</span>
          </div>
        </div>
      )}

      {inventory.craftingOpen && (
        <CraftingUI items={inventory.items} canCraft={inventory.canCraft} onCraft={inventory.craft} onClose={() => setCraftingOpen(false)} />
      )}

      <GameChat
        playerName={playerName}
        onOpenChange={handleChatOpenChange}
        canOpen={!paused && !dead && !craftingOpen && !shopOpen && !showRanking}
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
                ESC Fechar
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
      {/* Menu de pausa: ESC não encerra mais a partida direto */}
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm" style={{ zIndex: 70 }}>
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-xs text-center">
            <h2 className="font-pixel text-lg text-primary mb-2">⏸ PAUSADO</h2>
            <p className="text-xs font-game text-muted-foreground mb-5">
              {score} pontos • 🪙 {voxelCoins} • 💀 {mobsKilled} mobs
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={resumeGame}
                className="font-pixel text-xs px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                autoFocus
              >
                ▶ Continuar
              </button>
              <button
                onClick={() => onExit?.()}
                className="font-pixel text-[10px] px-4 py-2 bg-destructive/80 text-destructive-foreground rounded-lg hover:bg-destructive"
              >
                Sair para o menu
              </button>
            </div>
            <p className="text-[10px] font-game text-muted-foreground mt-4">
              Ao sair, o progresso desta partida é perdido.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
