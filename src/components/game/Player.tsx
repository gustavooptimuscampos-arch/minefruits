import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlockType, Fruit, ItemType, GameCoin, PLANT_BLOCKS } from './types';
import { MobData } from './mobs';
import { SkinData } from './skins';
import { PlayerModel } from './PlayerModel';
import { World } from './world';
import { touchInput, isTouchDevice } from './touchInput';

const TOUCH_LOOK_SPEED = 0.0055;
const MAX_PITCH = Math.PI / 2 - 0.05;
import { isTypingTarget } from './keyboard';
import { playerPosition, playerLook, playerCommands, mobRegistry } from './playerState';

interface PlayerProps {
  world: World;
  fruits: Fruit[];
  mobs: MobData[];
  coins?: GameCoin[];
  skin: SkinData;
  onBlockBreak: (key: string) => void;
  onFruitCollect: (id: string) => void;
  onCoinCollect?: (id: string) => void;
  onMobHit: (id: string, damage: number) => void;
  sendPosition?: (position: [number, number, number], rotation: number, isMoving: boolean, health: number) => void;
  playerHealth?: number;
  equippedItem?: ItemType | null;
  /** false enquanto um menu (craft, loja, chat, pausa) está aberto: o mouse não gira a câmera. */
  controlsEnabled?: boolean;
  /** Muda a cada morte: o jogador volta para o ponto de nascimento. */
  respawnKey?: number;
  aura?: { color: string; emissive: string } | null;
  /** Poderes passivos da fruta: pulo mais alto (Borracha), corrida mais rápida (Luz). */
  jumpBoost?: number;
  speedBoost?: number;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

const UNSAFE_SPAWN_SURFACES: BlockType[] = ['water', 'ice', ...PLANT_BLOCKS];

function findSafeSpawn(world: World) {
  for (let r = 0; r <= 12; r++) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) !== r && Math.abs(z) !== r) continue;

        const groundY = world.groundHeight(x, z);
        const surface = world.get(x, Math.max(0, groundY - 1), z);

        if (!surface || UNSAFE_SPAWN_SURFACES.includes(surface)) continue;

        const head1 = world.get(x, Math.floor(groundY + 1), z);
        const head2 = world.get(x, Math.floor(groundY + 2), z);
        if (head1 || head2) continue;

        return { x: x + 0.5, z: z + 0.5, groundY };
      }
    }
  }

  const fallbackGround = world.groundHeight(0, 0);
  return { x: 0.5, z: 0.5, groundY: fallbackGround };
}

// ── Colisão com os blocos (para andar dentro de cavernas sem atravessar paredes) ──
const RADIUS = 0.3;
const BODY_HEIGHT = 1.8;
const CORNER_OFFSETS: [number, number][] = [[-RADIUS, -RADIUS], [RADIUS, -RADIUS], [-RADIUS, RADIUS], [RADIUS, RADIUS]];

/** O corpo do jogador (com os pés em "feet") encostaria num bloco sólido? */
function bodyBlocked(world: World, x: number, feet: number, z: number): boolean {
  const y0 = Math.floor(feet + 0.01);
  const y1 = Math.floor(feet + BODY_HEIGHT - 0.01);
  for (const [ox, oz] of CORNER_OFFSETS) {
    const bx = Math.floor(x + ox), bz = Math.floor(z + oz);
    for (let y = y0; y <= y1; y++) if (world.isSolid(bx, y, bz)) return true;
  }
  return false;
}

/** Altura do chão logo abaixo dos pés (o maior entre os 4 cantos do corpo). */
function groundUnder(world: World, x: number, feet: number, z: number): number {
  let g = 0;
  for (const [ox, oz] of CORNER_OFFSETS) g = Math.max(g, world.floorBelow(x + ox, feet + 0.05, z + oz));
  return g;
}

function playFootstep(ref: React.MutableRefObject<AudioContext | null>, gain: number) {
  try {
    if (!ref.current) ref.current = new (window.AudioContext || (window as WebkitWindow).webkitAudioContext!)();
    const ctx = ref.current;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const buffer = ctx.createBuffer(1, 1600, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + Math.random() * 400;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(now);
  } catch { /* audio unavailable */ }
}

export function Player({ world, fruits, mobs, coins = [], skin, onBlockBreak, onFruitCollect, onCoinCollect, onMobHit, sendPosition, playerHealth = 100, controlsEnabled = true, respawnKey = 0, aura, jumpBoost = 1, speedBoost = 1 }: PlayerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<React.ElementRef<typeof PointerLockControls>>(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false });
  const worldRef = useRef(world);
  const fruitsRef = useRef(fruits);
  const mobsRef = useRef(mobs);
  const [thirdPerson, setThirdPerson] = useState(false);
  const thirdPersonRef = useRef(false);
  const playerPos = useRef(new THREE.Vector3(0, 8, 0));
  const playerYaw = useRef(0);
  const isMovingRef = useRef(false);
  const sprintRef = useRef(false);
  const crouchRef = useRef(false);
  const bobRef = useRef(0);
  const landDipRef = useRef(0);
  const wasOnGroundRef = useRef(true);
  const stepAccRef = useRef(0);
  const horizVel = useRef(new THREE.Vector3());
  const audioRef = useRef<AudioContext | null>(null);
  const attackRef = useRef<() => void>(() => {});
  const lookEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const jumpBoostRef = useRef(jumpBoost);
  jumpBoostRef.current = jumpBoost;
  const speedBoostRef = useRef(speedBoost);
  speedBoostRef.current = speedBoost;
  const controlsEnabledRef = useRef(controlsEnabled);
  controlsEnabledRef.current = controlsEnabled;
  worldRef.current = world;
  fruitsRef.current = fruits;
  mobsRef.current = mobs;

  const SPEED = 4.6;
  const SPRINT_MULT = 1.65;
  const CROUCH_MULT = 0.42;
  const ACCEL = 14;
  const FRICTION = 11;
  const BASE_FOV = 70;
  const JUMP_SPEED = 7;
  const GRAVITY = 18;
  const PLAYER_HEIGHT = 1.7;
  const ATTACK_RANGE = 4;
  const ATTACK_DAMAGE = 8;
  const THIRD_PERSON_DISTANCE = 5;
  const THIRD_PERSON_HEIGHT = 2;

  // Nasce ao montar e renasce a cada morte (respawnKey).
  // Não depende de "blocks": antes, quebrar um bloco teleportava o jogador de volta ao início.
  useEffect(() => {
    const safeSpawn = findSafeSpawn(worldRef.current);
    const spawnY = safeSpawn.groundY + PLAYER_HEIGHT + 2;
    camera.position.set(safeSpawn.x, spawnY, safeSpawn.z);
    playerPos.current.set(safeSpawn.x, spawnY, safeSpawn.z);
    velocity.current.set(0, 0, 0);
    horizVel.current.set(0, 0, 0);
    // Ordem YXZ (giro → inclinação → rolagem): mexer só no "z" nunca vira a câmera de ponta-cabeça
    camera.rotation.order = 'YXZ';
    // Look slightly downward so terrain is visible immediately
    camera.rotation.set(-0.4, 0, 0);
  }, [camera, respawnKey]);

  // Ao abrir um menu, solta todas as teclas: senão o keyup se perde e o jogador continua andando sozinho.
  useEffect(() => {
    if (controlsEnabled) return;
    moveState.current = { forward: false, backward: false, left: false, right: false, jump: false };
    sprintRef.current = false;
    crouchRef.current = false;
  }, [controlsEnabled]);

  // Toggle view with V key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': moveState.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': moveState.current.left = true; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right = true; break;
        case 'Space': moveState.current.jump = true; break;
        case 'ShiftLeft': case 'ShiftRight': sprintRef.current = true; break;
        case 'ControlLeft': case 'ControlRight': case 'KeyC': crouchRef.current = true; break;
        case 'KeyV':
          thirdPersonRef.current = !thirdPersonRef.current;
          setThirdPerson(thirdPersonRef.current);
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = false; break;
        case 'KeyS': case 'ArrowDown': moveState.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft': moveState.current.left = false; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right = false; break;
        case 'Space': moveState.current.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': sprintRef.current = false; break;
        case 'ControlLeft': case 'ControlRight': case 'KeyC': crouchRef.current = false; break;
      }
    };
    // Trocar de aba/janela também perde o keyup
    const releaseAll = () => {
      moveState.current = { forward: false, backward: false, left: false, right: false, jump: false };
      sprintRef.current = false;
      crouchRef.current = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, []);

  // Click (computador) ou botão de ataque (celular): atacar mobs ou quebrar blocos
  useEffect(() => {
    const attack = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      let hitMob = false;
      const currentMobs = mobsRef.current;
      for (const mob of currentMobs) {
        if (mob.dead) continue;
        // Posição de verdade do mob (antes usava onde ele nasceu e o golpe errava quem andou)
        const live = mobRegistry.get(mob.id);
        const mobPos = live ? live.pos.clone() : new THREE.Vector3(...mob.position);
        const origin = thirdPersonRef.current ? playerPos.current : camera.position;
        const toMob = mobPos.clone().sub(origin);
        const dist = toMob.length();
        if (dist > ATTACK_RANGE) continue;
        toMob.normalize();
        const dot = dir.dot(toMob);
        if (dot > 0.7) {
          onMobHit(mob.id, ATTACK_DAMAGE);
          hitMob = true;
          break;
        }
      }

      if (!hitMob) {
        const origin = thirdPersonRef.current ? playerPos.current.clone() : camera.position.clone();
        for (let d = 0.5; d < 5; d += 0.3) {
          const pos = origin.clone().add(dir.clone().multiplyScalar(d));
          const bx = Math.floor(pos.x);
          const by = Math.floor(pos.y);
          const bz = Math.floor(pos.z);
          const type = worldRef.current.get(bx, by, bz);
          if (type && type !== 'water') {
            onBlockBreak(`${bx},${by},${bz}`);
            break;
          }
        }
      }
    };
    attackRef.current = attack;
    const onClick = () => {
      if (document.pointerLockElement) attack();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [camera, onBlockBreak, onMobHit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { forward, backward, left, right, jump } = moveState.current;
    const currentWorld = worldRef.current;

    // Com menu aberto (craft, loja, pausa) os controles de toque não mexem o jogador
    if (!controlsEnabledRef.current) {
      touchInput.lookDX = 0;
      touchInput.lookDY = 0;
      touchInput.attacks = 0;
    }

    // Celular: arrastar o dedo gira a câmera
    if (touchInput.lookDX || touchInput.lookDY) {
      const e = lookEuler.current.setFromQuaternion(camera.quaternion, 'YXZ');
      e.y -= touchInput.lookDX * TOUCH_LOOK_SPEED;
      e.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, e.x - touchInput.lookDY * TOUCH_LOOK_SPEED));
      e.z = 0;
      camera.quaternion.setFromEuler(e);
      touchInput.lookDX = 0;
      touchInput.lookDY = 0;
    }
    while (touchInput.attacks > 0) {
      touchInput.attacks--;
      attackRef.current();
    }

    const forwardDir = new THREE.Vector3();
    camera.getWorldDirection(forwardDir);
    forwardDir.y = 0;
    forwardDir.normalize();

    const rightDir = new THREE.Vector3();
    rightDir.crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3();
    if (forward) moveDir.add(forwardDir);
    if (backward) moveDir.sub(forwardDir);
    if (right) moveDir.add(rightDir);
    if (left) moveDir.sub(rightDir);
    // Joystick do celular (analógico)
    if (controlsEnabledRef.current && Math.hypot(touchInput.moveX, touchInput.moveY) > 0.12) {
      moveDir.addScaledVector(forwardDir, -touchInput.moveY).addScaledVector(rightDir, touchInput.moveX);
    }
    const isMoving = moveDir.length() > 0;
    isMovingRef.current = isMoving;
    // Teclado: sempre velocidade cheia. Joystick: anda mais devagar com o dedo perto do centro.
    if (isMoving) moveDir.multiplyScalar(1 / Math.max(1, moveDir.length()));

    // Speed depends on sprint / crouch state
    const sprinting = (sprintRef.current || touchInput.sprint) && isMoving && !crouchRef.current;
    const crouching = crouchRef.current;
    const targetSpeed = SPEED * speedBoostRef.current * (sprinting ? SPRINT_MULT : crouching ? CROUCH_MULT : 1);

    // Acceleration + friction gives the movement weight (inertia)
    const desired = moveDir.clone().multiplyScalar(targetSpeed);
    const rate = isMoving ? ACCEL : FRICTION;
    horizVel.current.x += (desired.x - horizVel.current.x) * Math.min(1, rate * dt);
    horizVel.current.z += (desired.z - horizVel.current.z) * Math.min(1, rate * dt);
    if (horizVel.current.lengthSq() < 0.0004) horizVel.current.set(0, 0, 0);

    // Movimento com colisão: anda até a parede; degrau de 1 bloco sobe sozinho
    const pos = playerPos.current;
    let feet = pos.y - PLAYER_HEIGHT;
    const groundNow = groundUnder(currentWorld, pos.x, feet, pos.z);
    const wasOnGround = feet - groundNow <= 0.08;
    const tryMove = (nx: number, nz: number): boolean => {
      if (!bodyBlocked(currentWorld, nx, feet, nz)) { pos.x = nx; pos.z = nz; return true; }
      if (wasOnGround && !bodyBlocked(currentWorld, nx, feet + 1.02, nz) && !bodyBlocked(currentWorld, pos.x, feet + 1.02, pos.z)) {
        feet = Math.floor(feet + 0.01) + 1;
        pos.x = nx; pos.z = nz;
        return true;
      }
      return false;
    };
    // Poder da Luz: avança rápido na direção do olhar, parando antes de uma parede
    if (playerCommands.dash) {
      const d = playerCommands.dash;
      playerCommands.dash = null;
      const steps = Math.ceil(d.length() / 0.25);
      const stepX = d.x / steps, stepZ = d.z / steps;
      for (let i = 0; i < steps; i++) {
        if (bodyBlocked(currentWorld, pos.x + stepX, feet, pos.z + stepZ)) break;
        pos.x += stepX; pos.z += stepZ;
      }
    }
    if (!tryMove(pos.x + horizVel.current.x * dt, pos.z)) horizVel.current.x = 0;
    if (!tryMove(pos.x, pos.z + horizVel.current.z * dt)) horizVel.current.z = 0;

    velocity.current.y -= GRAVITY * dt;
    const groundY = groundUnder(currentWorld, pos.x, feet, pos.z);
    const onGround = feet - groundY <= 0.08;

    if ((jump || (touchInput.jump && controlsEnabledRef.current)) && onGround) {
      velocity.current.y = JUMP_SPEED * jumpBoostRef.current;
    }

    let newFeet = feet + velocity.current.y * dt;
    if (velocity.current.y > 0 && bodyBlocked(currentWorld, pos.x, newFeet, pos.z)) {
      // Bateu a cabeça no teto
      newFeet = feet;
      velocity.current.y = 0;
    }
    if (newFeet < groundY) {
      newFeet = groundY;
      velocity.current.y = 0;
    }
    pos.y = newFeet + PLAYER_HEIGHT;

    if (playerPos.current.y < -5) {
      const safeSpawn = findSafeSpawn(currentWorld);
      const respawnY = safeSpawn.groundY + PLAYER_HEIGHT + 2;
      playerPos.current.set(safeSpawn.x, respawnY, safeSpawn.z);
      velocity.current.set(0, 0, 0);
    }

    // Store yaw for model rotation
    playerYaw.current = Math.atan2(forwardDir.x, forwardDir.z);
    playerPosition.copy(playerPos.current);
    camera.getWorldDirection(playerLook);

    if (thirdPersonRef.current) {
      // Third person: camera behind player
      const behind = forwardDir.clone().multiplyScalar(-THIRD_PERSON_DISTANCE);
      camera.position.set(
        playerPos.current.x + behind.x,
        playerPos.current.y + THIRD_PERSON_HEIGHT,
        playerPos.current.z + behind.z,
      );
      camera.lookAt(playerPos.current.x, playerPos.current.y, playerPos.current.z);
    } else {
      // First person with head bob, crouch offset and landing dip
      const speedRatio = horizVel.current.length() / (SPEED * SPRINT_MULT);
      bobRef.current += dt * (8 + speedRatio * 9) * (onGround ? speedRatio : 0);
      const bobY = Math.sin(bobRef.current * 2) * 0.055 * speedRatio;
      const bobX = Math.cos(bobRef.current) * 0.035 * speedRatio;
      const side = rightDir.clone().multiplyScalar(bobX);

      camera.position.set(
        playerPos.current.x + side.x,
        playerPos.current.y + bobY - (crouching ? 0.45 : 0) - landDipRef.current,
        playerPos.current.z + side.z,
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.z = Math.sin(bobRef.current) * 0.006 * speedRatio;

      // Footsteps
      stepAccRef.current += horizVel.current.length() * dt;
      if (onGround && stepAccRef.current > (sprinting ? 1.6 : 2.1)) {
        stepAccRef.current = 0;
        playFootstep(audioRef, sprinting ? 0.06 : 0.04);
      }
    }

    // Field of view reacts to sprinting
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as THREE.PerspectiveCamera;
      const targetFov = BASE_FOV + (sprinting ? 8 : 0) - (crouching ? 3 : 0);
      cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 6);
      cam.updateProjectionMatrix();
    }

    // Landing impact
    if (onGround && !wasOnGroundRef.current) {
      landDipRef.current = Math.min(0.28, Math.abs(velocity.current.y) * 0.02 + 0.12);
      playFootstep(audioRef, 0.09);
    }
    wasOnGroundRef.current = onGround;
    landDipRef.current = Math.max(0, landDipRef.current - dt * 1.1);

    // Fruit collection
    fruitsRef.current.forEach(fruit => {
      if (fruit.collected) return;
      const dist = playerPos.current.distanceTo(new THREE.Vector3(...fruit.position));
      if (dist < 1.8) {
        onFruitCollect(fruit.id);
      }
    });

    // Coin collection
    coins.forEach(coin => {
      if (coin.collected) return;
      const dist = playerPos.current.distanceTo(new THREE.Vector3(...coin.position));
      if (dist < 1.5 && onCoinCollect) {
        onCoinCollect(coin.id);
      }
    });

    // Send position to multiplayer
    if (sendPosition) {
      sendPosition(
        [playerPos.current.x, playerPos.current.y, playerPos.current.z],
        playerYaw.current,
        isMoving,
        playerHealth,
      );
    }
  });

  return (
    <>
      {!isTouchDevice && (
        <PointerLockControls
          ref={controlsRef}
          selector="#game-canvas canvas"
          enabled={controlsEnabled}
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI - 0.05}
        />
      )}
      {thirdPerson && (
        <PlayerModel
          skin={skin}
          position={playerPos.current}
          rotation={playerYaw}
          isMoving={isMovingRef}
          isThirdPerson={thirdPerson}
          aura={aura}
        />
      )}
    </>
  );
}
