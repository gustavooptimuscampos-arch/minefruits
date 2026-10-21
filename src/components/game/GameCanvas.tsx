import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Player } from './Player';
import { Fruits } from './Fruits';
import { MobsRenderer } from './MobsRenderer';
import { Dog } from './Dog';
import { DayNightCycle } from './DayNightCycle';
import { ShadowFlags } from './ShadowFlags';
import { HeldItem } from './HeldItem';
import { GraphicsQuality, loadQuality, saveQuality } from './graphics';
import { Weather } from './Weather';
import { RemotePlayersRenderer } from './RemotePlayersRenderer';
import { GameHUD } from './GameHUD';
import { CraftingUI } from './CraftingUI';
import { GameChat, ChatMessage } from './GameChat';
import { FruitType, FOOD_VALUES, ItemType, PLACEABLE, MINING_REQUIREMENTS, BLOCK_DROPS, UNBREAKABLE, TOOL_DAMAGE, ITEM_CONFIG, AccessoryType, SHOP_ITEMS, FRUIT_CONFIG, Fruit, GameCoin } from './types';
import { MobData, MOB_CONFIG, spawnMobs, spawnGuardians, ANIMAL_FOOD, ANIMAL_EXTRA_DROPS } from './mobs';
import { SkinData } from './skins';
import { useMultiplayer } from './useMultiplayer';
import { useInventory } from './useInventory';
import { generateTerrain, generateFruits, generateCoins, generateStarterFruits } from './terrainGenerator';
import { CoinsRenderer } from './CoinsRenderer';
import { CoinShop } from './CoinShop';
import { MOB_POINTS, FRUIT_POINTS, FRUIT_HUNGER, ScoreEntry } from './scoring';
import { TouchControls } from './TouchControls';
import { isTouchDevice } from './touchInput';
import { isTypingTarget } from './keyboard';
import { BIOMES, BiomeId, biomeAt, buildBiomeLayout, seedFromString } from './biomes';
import { playerPosition, playerLook, playerCommands, mobRegistry, mobFrozenUntil, addPowerEffect } from './playerState';
import { PowerEffects } from './PowerEffects';
import { FRUIT_POWERS, ICE_FREEZE_SECONDS, POWER_USES, PowerUses, cleanUses, loadPowers, saveLocalPowers, usablePowers } from './powers';
import { supabase } from '@/integrations/supabase/client';
import { GameSave, WorldSave, loadLocalSave, saveLocal, saveCloud } from './save';

interface GameCanvasProps {
  skin: SkinData;
  multiplayer?: { roomCode: string; playerName: string };
  onExit?: () => void;
  /** Quem está jogando (id da conta ou "visitante"): os poderes ficam salvos para ele. */
  playerId?: string;
  /** Poderes já salvos na conta (para valer em qualquer aparelho). */
  savedPowers?: unknown;
  /** true quando há conta logada (aí os poderes também são salvos na conta). */
  loggedIn?: boolean;
  /** Progresso salvo (moedas, loja e, no solo, o mundo). */
  save?: GameSave | null;
  /** Solo: true = continua o mundo salvo; false = mundo novo. */
  continueWorld?: boolean;
}

export function GameCanvas({ skin, multiplayer, onExit, playerId = 'visitante', savedPowers, loggedIn = false, save = null, continueWorld = false }: GameCanvasProps) {
  // Mundo salvo (só no solo: no multiplayer o mapa é da sala)
  const [ws] = useState<WorldSave | null>(() => (!multiplayer && continueWorld ? save?.world ?? null : null));
  const personal = save?.personal;
  // Solo: mapa novo a cada partida. Multiplayer: a semente vem do código da sala,
  // então todos na sala recebem a mesma ilha.
  const [worldSeed] = useState(() => (multiplayer ? seedFromString(multiplayer.roomCode) : ws?.seed ?? Math.floor(Math.random() * 1e9)));
  const biomeLayout = useMemo(() => buildBiomeLayout(worldSeed), [worldSeed]);
  // O mundo é um objeto que muda no lugar; "worldVersion" avisa o React para redesenhar
  const world = useMemo(() => generateTerrain(biomeLayout), [biomeLayout]);
  const [worldVersion, setWorldVersion] = useState(0);
  const initialFruits = useMemo(() => {
    // Frutas dos Guardiões (para sempre) + frutas iniciais sem Guardião (10 usos), perto do começo
    const guarded = generateFruits(world, worldSeed, biomeLayout);
    const generated = [...guarded, ...generateStarterFruits(world, worldSeed)];
    if (!ws) return generated;
    // Continua o mundo salvo: refaz os blocos que o jogador quebrou/colocou (depois da geração das frutas, que cava escadas)
    world.importEdits(ws.edits);
    const taken = new Set(ws.fruitsTaken);
    return generated.map(f => (taken.has(f.id) ? { ...f, collected: true } : f));
  }, [world, worldSeed, biomeLayout, ws]);
  const [fruits, setFruits] = useState(initialFruits);
  const initialCoins = useMemo(() => {
    const generated = generateCoins(world, worldSeed);
    const taken = new Set(ws?.coinsTaken ?? []);
    return generated.map(c => (taken.has(c.id) ? { ...c, collected: true } : c));
  }, [world, worldSeed, ws]);
  const [coins, setCoins] = useState(initialCoins);
  const [voxelCoins, setVoxelCoins] = useState(() => personal?.voxelCoins ?? 0);
  const [shopOpen, setShopOpen] = useState(false);
  const [ownedItems, setOwnedItems] = useState<string[]>(() => personal?.ownedItems ?? []);
  const [equippedItems, setEquippedItems] = useState<Record<string, string | null>>(() => personal?.equippedItems ?? {});
  const [score, setScore] = useState(() => ws?.score ?? 0);
  const [collectedFruits, setCollectedFruits] = useState<FruitType[]>(() => ws?.collectedFruits ?? []);
  const [blocksDestroyed, setBlocksDestroyed] = useState(() => ws?.blocksDestroyed ?? 0);
  const [pointerLocked, setLocked] = useState(false);
  // No celular não existe "travar o mouse": o jogo fica ativo direto.
  const locked = pointerLocked || isTouchDevice;
  const [playerHealth, setPlayerHealth] = useState(() => (ws && ws.player.health > 0 ? ws.player.health : 100));
  const [hunger, setHunger] = useState(() => (ws ? Math.max(20, ws.player.hunger) : 100));
  const [isNight, setIsNight] = useState(false);
  const [mobs, setMobs] = useState<MobData[]>([]);
  const [mobsKilled, setMobsKilled] = useState(() => ws?.mobsKilled ?? 0);
  const [localChat, setLocalChat] = useState<ChatMessage[]>([]);
  const [showRanking, setShowRanking] = useState(false);
  const [scoreLog, setScoreLog] = useState<ScoreEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dead, setDead] = useState(false);
  // Cama: ponto de renascer e dormir à noite
  const [bed, setBed] = useState<{ block: [number, number, number]; spawn: [number, number, number] } | null>(() => ws?.bed ?? null);
  const [sleeping, setSleeping] = useState(false);
  const [respawnKey, setRespawnKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [biome, setBiome] = useState<BiomeId>('plains');
  // Poderes ganhos ficam para sempre (salvos); "power" é o que está em uso agora
  // Poderes ganhos: para sempre. Usos: 10 de cada por partida (continuar o mundo salvo mantém os que sobraram)
  // Poderes para sempre (fruta do Guardião) e usos dos poderes de frutas iniciais (10 por fruta)
  const [permanentPowers, setPowers] = useState<FruitType[]>(() => loadPowers(playerId, savedPowers));
  const [charges, setCharges] = useState<PowerUses>(() => cleanUses(ws?.powerUses));
  const powers = useMemo(() => usablePowers(permanentPowers, charges), [permanentPowers, charges]);
  const permanentRef = useRef(permanentPowers);
  permanentRef.current = permanentPowers;
  const [power, setPower] = useState<FruitType | null>(() => usablePowers(permanentPowers, charges).slice(-1)[0] ?? null);
  // Cada poder tem a sua recarga (antes era uma só: depois do Gelo a Luz ficava 8 s sem funcionar)
  const [powerReadyMap, setPowerReadyMap] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => performance.now());
  // Gráficos: alta (sombras, reflexos) ou baixa (celular)
  const [quality, setQuality] = useState<GraphicsQuality>(() => loadQuality());
  const hiQ = quality === 'alta';

  const inventory = useInventory(ws?.inventory);
  const { craftingOpen, setCraftingOpen, setSelectedSlot, equippedItem, collectBlock, addItem, removeItem, items: inventoryItems } = inventory;

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

  // Bioma onde o jogador está: atualiza o HUD e avisa ao entrar num bioma novo
  useEffect(() => {
    let current: BiomeId | null = null;
    const id = setInterval(() => {
      const next = biomeAt(playerPosition.x, playerPosition.z, biomeLayout);
      if (next === current) return;
      if (current !== null) showNotice(`${BIOMES[next].emoji} ${BIOMES[next].name}`);
      current = next;
      setBiome(next);
    }, 400);
    return () => clearInterval(id);
  }, [biomeLayout, showNotice]);

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
      // Guardiões já derrotados no jogo salvo continuam derrotados
      const beaten = new Set(ws?.guardiansDefeated ?? []);
      const guardians = spawnGuardians(initialFruits.filter(f => !f.wild), world)
        .map(g => (g.guardsFruit && beaten.has(g.guardsFruit) ? { ...g, health: 0, dead: true } : g));
      applyMobs([...guardians, ...spawnMobs(world, false)]);
      spawnedRef.current = true;
    }
  }, [world, applyMobs, initialFruits, ws]);

  const timeRef = useRef(ws?.time ?? 0.08);
  const handleTimeChange = useCallback((time: number, night: boolean) => {
    timeRef.current = time;
    if (night !== wasNightRef.current) {
      wasNightRef.current = night;
      setIsNight(night);
      // Os Guardiões continuam (vivos ou derrotados); só os mobs comuns trocam
      applyMobs([...mobsRef.current.filter(m => m.type === 'guardian'), ...spawnMobs(world, night)]);
    }
  }, [world, applyMobs]);

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

  const usePowerRef = useRef(() => {});

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
      if (e.code === 'KeyF') usePowerRef.current();
      if (e.code === 'KeyQ') cyclePowerRef.current();
      if (e.code === 'KeyG') eatRef.current();
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
    const [bx, by, bz] = key.split(',').map(Number);
    const blockType = world.get(bx, by, bz);
    if (!blockType || blockType === 'water') return;
    if (UNBREAKABLE.includes(blockType)) {
      showNotice('🪨 Bedrock não quebra: é o fundo do mundo');
      return;
    }
    const requirements = MINING_REQUIREMENTS[blockType];
    if (requirements && (!equippedItem || !requirements.includes(equippedItem))) {
      // Antes não acontecia nada e parecia bug: agora o jogador sabe o que falta
      showNotice(`⛏️ Precisa de ${ITEM_CONFIG[requirements[0]].label} ou melhor`);
      return;
    }
    // O bloco quebrado vai para o inventário
    collectBlock(blockType, equippedItem);
    const drop = BLOCK_DROPS[blockType];
    if (drop) showNotice(`+1 ${ITEM_CONFIG[drop].emoji} ${ITEM_CONFIG[drop].label}`);
    world.edit(bx, by, bz, null);
    setWorldVersion(v => v + 1);
    setScore(s => s + 10);
    setBlocksDestroyed(d => d + 1);
  }, [world, equippedItem, collectBlock, showNotice]);

  const lockNoticeAt = useRef(0);
  /** Coloca o bloco que está na mão (botão direito / 🧱 no celular). */
  const handleBlockPlace = useCallback((x: number, y: number, z: number) => {
    const item = equippedItem;
    const block = item ? PLACEABLE[item] : undefined;
    if (!item || !block) {
      showNotice('🧱 Segure um bloco na mão (números 1-9) para colocar');
      return;
    }
    const current = world.get(x, y, z);
    if (!world.inBounds(x, y, z) || (current && current !== 'water')) return;
    // Não deixa colocar bloco dentro do próprio jogador
    const feet = playerPosition.y - 1.7;
    const insideX = x + 1 > playerPosition.x - 0.3 && x < playerPosition.x + 0.3;
    const insideZ = z + 1 > playerPosition.z - 0.3 && z < playerPosition.z + 0.3;
    const insideY = y + 1 > feet && y < feet + 1.8;
    if (insideX && insideZ && insideY) { showNotice('🧱 Muito perto: mire um pouco mais à frente'); return; }
    if (!removeItem(item, 1)) return;
    world.edit(x, y, z, block);
    setWorldVersion(v => v + 1);
  }, [equippedItem, world, removeItem, showNotice]);

  const handleFruitCollect = useCallback((id: string) => {
    const fruit = fruitsRef.current.find(f => f.id === id);
    if (!fruit || fruit.collected) return;
    // Fruta protegida: precisa derrotar o Guardião primeiro
    const guardian = mobsRef.current.find(m => m.guardsFruit === id && !m.dead);
    if (guardian) {
      if (performance.now() - lockNoticeAt.current > 2500) {
        lockNoticeAt.current = performance.now();
        showNotice('🛡️ Derrote o Guardião para pegar a fruta!');
      }
      return;
    }
    fruitsRef.current = fruitsRef.current.map(f => f.id === id ? { ...f, collected: true } : f);
    setFruits(fruitsRef.current);

    const pts = FRUIT_POINTS[fruit.type];
    const config = FRUIT_CONFIG[fruit.type];
    if (!fruit.wild) setCollectedFruits(prev => [...prev, fruit.type]); // o contador "Frutas: x de 8" é das frutas dos Guardiões
    setScore(s => s + pts);
    setHunger(h => Math.min(100, h + FRUIT_HUNGER[fruit.type]));
    setScoreLog(prev => {
      const existing = prev.find(e => e.type === 'fruit' && e.name === config.name);
      if (existing) return prev.map(e => e === existing ? { ...e, count: e.count + 1, points: e.points + pts } : e);
      return [...prev, { type: 'fruit', name: config.name, emoji: config.power.split(' ')[0], points: pts, count: 1 }];
    });
    const info = FRUIT_POWERS[fruit.type];
    setPower(fruit.type);
    setPowerReadyMap(prev => ({ ...prev, [fruit.type]: 0 }));
    if (!fruit.wild) {
      // Fruta do Guardião: o poder é para sempre e sem limite de usos
      setPowers(prev => (prev.includes(fruit.type) ? prev : [...prev, fruit.type]));
      setCharges(prev => { const next = { ...prev }; delete next[fruit.type]; return next; });
      showNotice(`${info.emoji} Poder ${info.name} é seu PARA SEMPRE! Aperte F`);
    } else if (permanentRef.current.includes(fruit.type)) {
      showNotice(`${info.emoji} Você já tem ${info.name} para sempre!`);
    } else {
      // Fruta inicial (sem Guardião): só 10 usos
      setCharges(prev => ({ ...prev, [fruit.type]: (prev[fruit.type] ?? 0) + POWER_USES }));
      showNotice(`${info.emoji} ${info.name}: ${POWER_USES} usos! Derrote o Guardião dessa fruta para ter para sempre`);
    }
  }, [showNotice]);

  // Salva os poderes neste aparelho e, com conta, na conta também
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!savedOnce.current) { savedOnce.current = true; if (permanentPowers.length === 0) return; }
    saveLocalPowers(playerId, permanentPowers);
    if (loggedIn) supabase.auth.updateUser({ data: { fruit_powers: permanentPowers } }).catch(() => { /* fica salvo no aparelho */ });
  }, [permanentPowers, playerId, loggedIn]);

  // Os usos do poder em uso acabaram: passa para outro que dê para usar
  useEffect(() => {
    if (power && !powers.includes(power)) setPower(powers[powers.length - 1] ?? null);
    else if (!power && powers.length) setPower(powers[powers.length - 1]);
  }, [power, powers]);

  /** Troca o poder em uso entre os que o jogador já tem. */
  const cyclePower = useCallback(() => {
    if (powers.length < 2) return;
    const next = powers[(powers.indexOf(power ?? powers[0]) + 1) % powers.length];
    setPower(next);
    showNotice(`${FRUIT_POWERS[next].emoji} Usando: ${FRUIT_POWERS[next].name}`);
  }, [powers, power, showNotice]);
  const cyclePowerRef = useRef(cyclePower);
  cyclePowerRef.current = cyclePower;

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
    // Animais deixam comida no inventário (aperte G para comer)
    const food = ANIMAL_FOOD[mob.type];
    if (food) {
      const [item, min, max] = food;
      const amount = min + Math.floor(Math.random() * (max - min + 1));
      addItem(item, amount);
      const extra = ANIMAL_EXTRA_DROPS[mob.type];
      let extraText = '';
      if (extra) {
        // a ovelha também dá lã (para fazer a cama)
        const [eItem, eMin, eMax] = extra;
        const eAmount = eMin + Math.floor(Math.random() * (eMax - eMin + 1));
        addItem(eItem, eAmount);
        extraText = ` e +${eAmount} ${ITEM_CONFIG[eItem].emoji} ${ITEM_CONFIG[eItem].label}`;
      }
      showNotice(`+${amount} ${ITEM_CONFIG[item].emoji} ${ITEM_CONFIG[item].label}${extraText} — aperte G para comer`);
    }
    if (mob.type === 'guardian') {
      setVoxelCoins(c => c + 10);
      // Derrotou o Guardião: a fruta dele é sua na hora e o poder fica PARA SEMPRE
      // (não precisa achar a fruta depois, nem dá para confundir com uma fruta inicial)
      const fruit = mob.guardsFruit ? fruitsRef.current.find(f => f.id === mob.guardsFruit && !f.collected) : undefined;
      if (fruit) {
        handleFruitCollect(fruit.id);
        const info = FRUIT_POWERS[fruit.type];
        showNotice(`🛡️ Guardião derrotado! ${info.emoji} ${info.name} é seu PARA SEMPRE · aperte F`);
      } else {
        showNotice('🛡️ Guardião derrotado!');
      }
    }
  }, [applyMobs, showNotice, addItem, handleFruitCollect]);

  /** Come uma comida do inventário (a que mais enche, ou a escolhida). */
  const eat = useCallback((chosen?: ItemType) => {
    const foods = inventoryItems
      .filter(i => FOOD_VALUES[i.type] && i.count > 0)
      .sort((a, b) => (FOOD_VALUES[b.type] ?? 0) - (FOOD_VALUES[a.type] ?? 0));
    const pick = chosen ? foods.find(f => f.type === chosen) : foods[0];
    if (!pick) { showNotice('🍖 Sem comida. Mate animais para conseguir carne'); return; }
    if (hungerRef.current >= 100) { showNotice('😋 Você está sem fome'); return; }
    removeItem(pick.type, 1);
    setHunger(h => Math.min(100, h + (FOOD_VALUES[pick.type] ?? 0)));
    showNotice(`😋 Comeu ${ITEM_CONFIG[pick.type].emoji} ${ITEM_CONFIG[pick.type].label}`);
  }, [inventoryItems, removeItem, showNotice]);
  const eatRef = useRef(eat);
  eatRef.current = eat;
  const hungerRef = useRef(hunger);
  hungerRef.current = hunger;
  const foodCount = inventoryItems.reduce((n, i) => n + (FOOD_VALUES[i.type] ? i.count : 0), 0);

  /** Usa o poder da fruta (tecla F ou botão ✨ no celular). */
  const powerReadyAt = power ? (powerReadyMap[power] ?? 0) : 0;
  const usePower = useCallback(() => {
    if (!power) { showNotice('🍎 Pegue uma fruta para ganhar um poder'); return; }
    const forever = permanentPowers.includes(power);
    if (!forever && (charges[power] ?? 0) <= 0) return;
    const t = performance.now();
    if (t < powerReadyAt) {
      showNotice(`⏳ ${FRUIT_POWERS[power].name} recarregando: ${Math.ceil((powerReadyAt - t) / 1000)} s`);
      return;
    }
    const info = FRUIT_POWERS[power];
    setPowerReadyMap(prev => ({ ...prev, [power]: t + info.cooldown * 1000 }));
    // Poder de fruta inicial: gasta 1 uso (o da fruta do Guardião não tem limite)
    if (!forever) {
      const left = Math.max(0, (charges[power] ?? 0) - 1);
      setCharges(prev => { const next = { ...prev }; if (left > 0) next[power] = left; else delete next[power]; return next; });
      if (left === 0) {
        setTimeout(() => showNotice(`${info.emoji} Acabaram os usos de ${info.name}! Derrote o Guardião da fruta para ter para sempre`), 50);
      } else if (left <= 3) {
        showNotice(`${info.emoji} ${info.name}: só ${left} ${left === 1 ? 'uso' : 'usos'}!`);
      }
    }

    const me = playerPosition.clone();
    const look = playerLook.clone();
    const flat = new THREE.Vector3(look.x, 0, look.z).normalize();
    // Os poderes acertam monstros, Guardiões e animais (antes só monstros: de dia parecia que não faziam nada)
    const targets = mobsRef.current.filter(m => !m.dead && m.type !== 'villager');
    const centerOf = (id: string) => {
      const r = mobRegistry.get(id);
      return r ? r.pos.clone().setY(r.pos.y + r.centerY) : null;
    };
    const near = (r: number) => targets.filter(m => { const p = centerOf(m.id); return !!p && p.distanceTo(me) <= r + 1; });

    if (power === 'flame') {
      // Bola de fogo: queima tudo num cone à frente
      const center = me.clone().addScaledVector(flat, 3.5);
      addPowerEffect('flame', center, 3.5);
      for (const m of near(8)) {
        const p = centerOf(m.id)!;
        const to = new THREE.Vector3(p.x - me.x, 0, p.z - me.z).normalize();
        if (to.dot(flat) > 0.45) handleMobHit(m.id, info.damage);
      }
    } else if (power === 'ice') {
      // Congela os monstros em volta
      addPowerEffect('ice', me, 9);
      for (const m of near(9)) {
        mobFrozenUntil.set(m.id, t + ICE_FREEZE_SECONDS * 1000);
        handleMobHit(m.id, info.damage);
      }
    } else if (power === 'light') {
      // Teleporte de luz para a frente
      addPowerEffect('light', me, 2);
      playerCommands.dash = flat.clone().multiplyScalar(12);
      setTimeout(() => addPowerEffect('light', playerPosition, 2.5), 50);
    } else if (power === 'dark') {
      // Buraco negro: machuca todos em volta e rouba vida
      addPowerEffect('dark', me, 10);
      const hit = near(10);
      hit.forEach(m => handleMobHit(m.id, info.damage));
      if (hit.length) setPlayerHealth(h => Math.min(100, h + 5 * hit.length));
    } else if (power === 'rubber') {
      // Soco de borracha: estica e acerta o primeiro monstro na mira
      const target = near(14)
        .map(m => ({ m, p: centerOf(m.id)! }))
        // Mira só na horizontal: olhar um pouco para cima/baixo não faz errar o soco
        .filter(({ p }) => new THREE.Vector3(p.x - me.x, 0, p.z - me.z).normalize().dot(flat) > 0.75)
        .sort((a, b) => a.p.distanceTo(me) - b.p.distanceTo(me))[0];
      addPowerEffect('rubber', target ? target.p : me.clone().addScaledVector(look, 6), 1.6);
      if (target) handleMobHit(target.m.id, info.damage);
    }
  }, [power, permanentPowers, powerReadyAt, handleMobHit, showNotice, charges]);
  useEffect(() => { usePowerRef.current = usePower; }, [usePower]);
  // Atualiza a barra de recarga do poder
  useEffect(() => {
    if (now >= powerReadyAt) return;
    const id = setTimeout(() => setNow(performance.now()), 100);
    return () => clearTimeout(id);
  }, [now, powerReadyAt]);
  useEffect(() => { setNow(performance.now()); }, [powerReadyAt]);

  /** O cachorro ajuda, mas quase não machuca o Guardião (senão a fruta ficava fácil). */
  const handleDogHit = useCallback((id: string, damage: number) => {
    const mob = mobsRef.current.find(m => m.id === id);
    handleMobHit(id, mob?.type === 'guardian' ? 1 : damage);
  }, [handleMobHit]);

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

  // ---------- Salvar o progresso ----------
  // Tudo o que entra no salvamento, sempre com o valor mais novo (os timers leem daqui)
  const latest = useRef({ voxelCoins, ownedItems, equippedItems, score, collectedFruits, blocksDestroyed, mobsKilled, playerHealth, hunger, inventory, charges, bed });
  latest.current = { voxelCoins, ownedItems, equippedItems, score, collectedFruits, blocksDestroyed, mobsKilled, playerHealth, hunger, inventory, charges, bed };

  const buildSave = useCallback((): GameSave => {
    const l = latest.current;
    let worldSave: WorldSave | null;
    if (isMultiplayer) {
      // No multiplayer o mundo é da sala: mantém o mundo solo que já estava salvo
      worldSave = loadLocalSave(playerId)?.world ?? save?.world ?? null;
    } else {
      worldSave = {
        seed: worldSeed,
        edits: world.exportEdits(),
        player: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z, health: l.playerHealth, hunger: l.hunger },
        inventory: { items: l.inventory.items, hotbar: l.inventory.hotbar, selected: l.inventory.selectedSlot },
        score: l.score,
        blocksDestroyed: l.blocksDestroyed,
        mobsKilled: l.mobsKilled,
        collectedFruits: l.collectedFruits,
        fruitsTaken: fruitsRef.current.filter(f => f.collected).map(f => f.id),
        coinsTaken: coinsRef.current.filter(c => c.collected).map(c => c.id),
        guardiansDefeated: mobsRef.current.filter(m => m.type === 'guardian' && m.dead && m.guardsFruit).map(m => m.guardsFruit!),
        time: timeRef.current,
        powerUses: l.charges,
        bed: l.bed,
      };
    }
    return {
      v: 1,
      savedAt: Date.now(),
      personal: { voxelCoins: l.voxelCoins, ownedItems: l.ownedItems, equippedItems: l.equippedItems },
      world: worldSave,
    };
  }, [isMultiplayer, playerId, save, worldSeed, world]);

  const lastCloudSave = useRef(0);
  /** Salva no aparelho (na hora) e, com conta, na nuvem (no máximo a cada 45 s, ou já se forçado). */
  const saveNow = useCallback((forceCloud = false) => {
    const data = buildSave();
    saveLocal(playerId, data);
    if (loggedIn && (forceCloud || Date.now() - lastCloudSave.current > 45000)) {
      lastCloudSave.current = Date.now();
      saveCloud(playerId, data).catch(() => {});
    }
  }, [buildSave, playerId, loggedIn]);
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  useEffect(() => {
    // Salvamento automático a cada 15 s
    const id = setInterval(() => saveNowRef.current(), 15000);
    // Fechar a aba, trocar de app no celular, desligar a tela: salva antes
    const onHide = () => { if (document.visibilityState === 'hidden') saveNowRef.current(true); };
    const onLeave = () => saveNowRef.current(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      saveNowRef.current(true); // saiu da partida (botão Sair, voltar do navegador...)
    };
  }, []);

  // ---------- Cama ----------
  const isNightRef = useRef(isNight);
  isNightRef.current = isNight;
  /** Botão direito na cama: marca o ponto de renascer e, à noite, dorme até de manhã. */
  const handleBlockUse = useCallback((x: number, y: number, z: number, type: string) => {
    if (type !== 'bed') return false;
    // renasce em pé ao lado da cama (ou em cima dela, se não houver espaço)
    const free = (nx: number, nz: number) =>
      !world.isSolid(nx, y, nz) && !world.isSolid(nx, y + 1, nz) && world.isSolid(nx, y - 1, nz);
    const side = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dz]) => free(x + dx, z + dz));
    const spawn: [number, number, number] = side
      ? [x + side[0] + 0.5, y + 1.7, z + side[1] + 0.5]
      : [x + 0.5, y + 2.7, z + 0.5];
    setBed({ block: [x, y, z], spawn });
    if (!isNightRef.current) {
      showNotice('🛏️ Cama marcada: você renasce aqui. Dormir, só à noite 🌙');
      return true;
    }
    // Dorme: a tela escurece e o dia amanhece
    setSleeping(true);
    releasePointer();
    setTimeout(() => {
      playerCommands.setTime = 0.8; // manhã
      setHunger(h => Math.max(10, h - 10)); // acorda com um pouco de fome
      setTimeout(() => { setSleeping(false); showNotice('☀️ Bom dia! Você dormiu a noite toda'); }, 600);
    }, 1600);
    return true;
  }, [world, showNotice, releasePointer]);

  // Renascer: ao lado da cama, se ela ainda existir
  const bedOk = !!bed && world.get(bed.block[0], bed.block[1], bed.block[2]) === 'bed';
  useEffect(() => {
    if (bed && !bedOk) { setBed(null); showNotice('🛏️ Sua cama foi quebrada: você vai renascer no começo do mapa'); }
  }, [bed, bedOk, worldVersion, showNotice]);

  const lockedFruitIds = useMemo(
    () => new Set(mobs.filter(m => m.type === 'guardian' && !m.dead && m.guardsFruit).map(m => m.guardsFruit!)),
    [mobs],
  );

  return (
    <div id="game-canvas" className="relative w-full h-[100dvh] overflow-hidden touch-none select-none" style={{ background: '#87CEEB', overscrollBehavior: 'none' }}>
      <Canvas
        shadows={hiQ ? 'soft' : false}
        camera={{ fov: 70, near: 0.1, far: 250, position: [0, 20, 0] }}
        style={{ background: '#87CEEB' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={hiQ ? [1, 1.5] : [0.75, 1]}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color('#7ec0ee');
          scene.fog = new THREE.Fog('#7ec0ee', 60, 170);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <DayNightCycle onTimeChange={handleTimeChange} speed={0.000556} initialTime={ws?.time} shadows={hiQ} />
        <Weather />
        <Terrain world={world} version={worldVersion} shadows={hiQ} />
        <ShadowFlags enabled={hiQ} />
        <Fruits fruits={fruits} lockedIds={lockedFruitIds} />
        <PowerEffects />
        <CoinsRenderer coins={coins} />
        <Dog world={world} onMobHit={handleDogHit} />
        <MobsRenderer mobs={mobs} world={world} onPlayerDamage={handlePlayerDamage} />
        <Player
          world={world} fruits={fruits} mobs={mobs} coins={coins} skin={effectiveSkin}
          onBlockBreak={handleBlockBreak} onBlockPlace={handleBlockPlace}
          onBlockUse={handleBlockUse} respawnPoint={bedOk ? bed!.spawn : null}
          onUseItem={equippedItem && FOOD_VALUES[equippedItem] ? () => eat(equippedItem) : undefined}
          onFruitCollect={handleFruitCollect} onCoinCollect={handleCoinCollect}
          onMobHit={handlePlayerAttack} sendPosition={isMultiplayer ? mp.sendPosition : undefined}
          playerHealth={playerHealth} equippedItem={equippedItem}
          controlsEnabled={!anyOverlay} respawnKey={respawnKey} aura={auraData}
          startPosition={ws ? [ws.player.x, ws.player.y, ws.player.z] : null}
          jumpBoost={powers.includes('rubber') ? 1.6 : 1} speedBoost={powers.includes('light') ? 1.25 : 1}
        />
        {isMultiplayer && <RemotePlayersRenderer players={mp.remotePlayers} />}
        {/* o que o jogador segura, na frente da câmera */}
        {!dead && <HeldItem item={equippedItem ?? null} armColor={effectiveSkin.arms} />}
      </Canvas>

      {/* No celular, "Sair" abre a pausa (com Continuar / Sair), igual ao ESC no computador */}
      {isTouchDevice && !dead && <TouchControls onExit={() => setPaused(true)} onPower={() => usePowerRef.current()} />}

      <GameHUD
        score={score} collectedFruits={collectedFruits} blocksDestroyed={blocksDestroyed}
        playerHealth={playerHealth} hunger={hunger} isNight={isNight} mobsKilled={mobsKilled} foodCount={foodCount}
        roomCode={multiplayer?.roomCode}
        playersOnline={isMultiplayer ? mp.remotePlayers.length + 1 : undefined}
        inventory={inventory} voxelCoins={voxelCoins} locked={locked || anyOverlay}
        totalFruits={fruits.filter(f => !f.wild).length}
        biome={`${BIOMES[biome].emoji} ${BIOMES[biome].name}`}
        powers={powers.map(t => ({ type: t, emoji: FRUIT_POWERS[t].emoji, name: FRUIT_POWERS[t].name, description: FRUIT_POWERS[t].description, cooldown: FRUIT_POWERS[t].cooldown, uses: permanentPowers.includes(t) ? undefined : charges[t] ?? 0 }))}
        onSelectPower={(t: FruitType) => setPower(t)}
        power={power ? { emoji: FRUIT_POWERS[power].emoji, name: FRUIT_POWERS[power].name, cooldown: FRUIT_POWERS[power].cooldown, remaining: Math.max(0, (powerReadyAt - now) / 1000), uses: permanentPowers.includes(power) ? undefined : charges[power] ?? 0 } : null}
        guardiansLeft={mobs.filter(m => m.type === 'guardian' && !m.dead).length}
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
        <CraftingUI items={inventory.items} canCraft={inventory.canCraft} onCraft={inventory.craft} onEat={(t) => eat(t)} onClose={() => setCraftingOpen(false)} />
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
                🛡️ Guardião: 150pts • 🧟 Zumbi: 50pts • 💀 Esqueleto: 60pts • 🕷️ Aranha: 40pts
              </p>
              <p className="text-xs font-game text-muted-foreground text-center mt-1">
                🔥 Fogo: 200pts • ❄️ Gelo: 150pts • ⚡ Luz: 250pts • 🌑 Trevas: 300pts • 🩷 Borracha: 100pts
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Dormindo na cama: a tela escurece */}
      {sleeping && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 transition-opacity" style={{ zIndex: 75 }}>
          <div className="text-5xl mb-3 animate-pulse">💤</div>
          <p className="font-pixel text-sm text-white/80">Dormindo...</p>
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
                onClick={() => { const next = hiQ ? 'baixa' : 'alta'; setQuality(next); saveQuality(next); }}
                className="font-pixel text-[10px] px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
              >
                🎨 Gráficos: {hiQ ? 'ALTA (sombras e reflexos)' : 'BAIXA (mais leve)'}
              </button>
              <button
                onClick={() => { saveNowRef.current(true); onExit?.(); }}
                className="font-pixel text-[10px] px-4 py-2 bg-destructive/80 text-destructive-foreground rounded-lg hover:bg-destructive"
              >
                💾 Salvar e sair
              </button>
            </div>
            <p className="text-[10px] font-game text-muted-foreground mt-4">
              💾 {isMultiplayer ? 'Suas moedas e itens da loja ficam salvos.' : 'O progresso é salvo sozinho. Ao voltar, escolha "Continuar".'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
