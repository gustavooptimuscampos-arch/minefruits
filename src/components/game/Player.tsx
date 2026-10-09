import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlockType, Fruit, ItemType, TOOL_DAMAGE, GameCoin } from './types';
import { MobData } from './mobs';
import { SkinData } from './skins';
import { PlayerModel } from './PlayerModel';
import { getGroundHeight } from './terrainGenerator';

interface PlayerProps {
  blocks: Record<string, BlockType>;
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
}

const UNSAFE_SPAWN_SURFACES: BlockType[] = ['water', 'leaves', 'wood', 'flower'];

function findSafeSpawn(blocks: Record<string, BlockType>) {
  for (let r = 0; r <= 12; r++) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) !== r && Math.abs(z) !== r) continue;

        const groundY = getGroundHeight(x, z, blocks);
        const surfaceKey = `${x},${Math.max(0, groundY - 1)},${z}`;
        const surface = blocks[surfaceKey];

        if (!surface || UNSAFE_SPAWN_SURFACES.includes(surface)) continue;

        const head1 = blocks[`${x},${Math.floor(groundY + 1)},${z}`];
        const head2 = blocks[`${x},${Math.floor(groundY + 2)},${z}`];
        if (head1 || head2) continue;

        return { x: x + 0.5, z: z + 0.5, groundY };
      }
    }
  }

  const fallbackGround = getGroundHeight(0, 0, blocks);
  return { x: 0.5, z: 0.5, groundY: fallbackGround };
}

function playFootstep(ref: React.MutableRefObject<AudioContext | null>, gain: number) {
  try {
    if (!ref.current) ref.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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

export function Player({ blocks, fruits, mobs, coins = [], skin, onBlockBreak, onFruitCollect, onCoinCollect, onMobHit, sendPosition, playerHealth = 100, equippedItem }: PlayerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false });
  const blocksRef = useRef(blocks);
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
  blocksRef.current = blocks;
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

  useEffect(() => {
    const safeSpawn = findSafeSpawn(blocks);
    const spawnY = safeSpawn.groundY + PLAYER_HEIGHT + 2;
    camera.position.set(safeSpawn.x, spawnY, safeSpawn.z);
    playerPos.current.set(safeSpawn.x, spawnY, safeSpawn.z);
    // Ordem YXZ (giro → inclinação → rolagem): mexer só no "z" nunca vira a câmera de ponta-cabeça
    camera.rotation.order = 'YXZ';
    // Look slightly downward so terrain is visible immediately
    camera.rotation.set(-0.4, 0, 0);
  }, [camera, blocks]);

  // Toggle view with V key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Click: attack mobs or break blocks
  useEffect(() => {
    const onClick = () => {
      if (!document.pointerLockElement) return;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      let hitMob = false;
      const currentMobs = mobsRef.current;
      for (const mob of currentMobs) {
        if (mob.dead) continue;
        const mobPos = new THREE.Vector3(...mob.position);
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
          const key = `${bx},${by},${bz}`;
          if (blocksRef.current[key]) {
            onBlockBreak(key);
            break;
          }
        }
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [camera, onBlockBreak, onMobHit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { forward, backward, left, right, jump } = moveState.current;
    const currentBlocks = blocksRef.current;

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
    const isMoving = moveDir.length() > 0;
    isMovingRef.current = isMoving;
    if (isMoving) moveDir.normalize();

    // Speed depends on sprint / crouch state
    const sprinting = sprintRef.current && isMoving && !crouchRef.current;
    const crouching = crouchRef.current;
    const targetSpeed = SPEED * (sprinting ? SPRINT_MULT : crouching ? CROUCH_MULT : 1);

    // Acceleration + friction gives the movement weight (inertia)
    const desired = moveDir.clone().multiplyScalar(targetSpeed);
    const rate = isMoving ? ACCEL : FRICTION;
    horizVel.current.x += (desired.x - horizVel.current.x) * Math.min(1, rate * dt);
    horizVel.current.z += (desired.z - horizVel.current.z) * Math.min(1, rate * dt);
    if (horizVel.current.lengthSq() < 0.0004) horizVel.current.set(0, 0, 0);

    playerPos.current.x += horizVel.current.x * dt;
    playerPos.current.z += horizVel.current.z * dt;

    velocity.current.y -= GRAVITY * dt;

    const groundY = getGroundHeight(playerPos.current.x, playerPos.current.z, currentBlocks);
    const onGround = playerPos.current.y <= groundY + PLAYER_HEIGHT + 0.1;

    if (jump && onGround) {
      velocity.current.y = JUMP_SPEED;
    }

    playerPos.current.y += velocity.current.y * dt;

    if (playerPos.current.y < groundY + PLAYER_HEIGHT) {
      playerPos.current.y = groundY + PLAYER_HEIGHT;
      velocity.current.y = 0;
    }

    if (playerPos.current.y < -5) {
      const safeSpawn = findSafeSpawn(currentBlocks);
      const respawnY = safeSpawn.groundY + PLAYER_HEIGHT + 2;
      playerPos.current.set(safeSpawn.x, respawnY, safeSpawn.z);
      velocity.current.set(0, 0, 0);
    }

    // Store yaw for model rotation
    playerYaw.current = Math.atan2(forwardDir.x, forwardDir.z);

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
      <PointerLockControls ref={controlsRef} minPolarAngle={0.05} maxPolarAngle={Math.PI - 0.05} />
      {thirdPerson && (
        <PlayerModel
          skin={skin}
          position={playerPos.current}
          rotation={playerYaw.current}
          isMoving={isMovingRef.current}
          isThirdPerson={thirdPerson}
        />
      )}
    </>
  );
}
