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
  blocksRef.current = blocks;
  fruitsRef.current = fruits;
  mobsRef.current = mobs;

  const SPEED = 6;
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

    // Update player position
    playerPos.current.x += moveDir.x * SPEED * dt;
    playerPos.current.z += moveDir.z * SPEED * dt;

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
      const respawnY = Math.max(getGroundHeight(0, 0, currentBlocks) + PLAYER_HEIGHT + 3, 20);
      playerPos.current.set(0, respawnY, 0);
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
      // First person
      camera.position.copy(playerPos.current);
    }

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
      <PointerLockControls ref={controlsRef} />
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
