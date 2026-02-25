import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlockType, Fruit } from './types';
import { MobData } from './mobs';
import { getGroundHeight } from './terrainGenerator';

interface PlayerProps {
  blocks: Record<string, BlockType>;
  fruits: Fruit[];
  mobs: MobData[];
  onBlockBreak: (key: string) => void;
  onFruitCollect: (id: string) => void;
  onMobHit: (id: string, damage: number) => void;
}

export function Player({ blocks, fruits, mobs, onBlockBreak, onFruitCollect, onMobHit }: PlayerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false });
  const blocksRef = useRef(blocks);
  const fruitsRef = useRef(fruits);
  const mobsRef = useRef(mobs);
  blocksRef.current = blocks;
  fruitsRef.current = fruits;
  mobsRef.current = mobs;

  const SPEED = 6;
  const JUMP_SPEED = 7;
  const GRAVITY = 18;
  const PLAYER_HEIGHT = 1.7;
  const ATTACK_RANGE = 4;
  const ATTACK_DAMAGE = 8;

  useEffect(() => {
    camera.position.set(0, 8, 0);
  }, [camera]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': moveState.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': moveState.current.left = true; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right = true; break;
        case 'Space': moveState.current.jump = true; break;
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

  // Click: break blocks OR attack mobs
  useEffect(() => {
    const onClick = () => {
      if (!document.pointerLockElement) return;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      // Check mob hit first (raycast towards mobs)
      let hitMob = false;
      const currentMobs = mobsRef.current;
      for (const mob of currentMobs) {
        if (mob.dead) continue;
        const mobPos = new THREE.Vector3(...mob.position);
        const toMob = mobPos.clone().sub(camera.position);
        const dist = toMob.length();
        if (dist > ATTACK_RANGE) continue;

        // Check if looking towards mob
        toMob.normalize();
        const dot = dir.dot(toMob);
        if (dot > 0.85) { // roughly aimed at mob
          onMobHit(mob.id, ATTACK_DAMAGE);
          hitMob = true;
          break;
        }
      }

      // If no mob hit, try breaking a block
      if (!hitMob) {
        for (let d = 0.5; d < 5; d += 0.3) {
          const pos = camera.position.clone().add(dir.clone().multiplyScalar(d));
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
    if (moveDir.length() > 0) moveDir.normalize();

    camera.position.x += moveDir.x * SPEED * dt;
    camera.position.z += moveDir.z * SPEED * dt;

    velocity.current.y -= GRAVITY * dt;

    const groundY = getGroundHeight(camera.position.x, camera.position.z, currentBlocks);
    const onGround = camera.position.y <= groundY + PLAYER_HEIGHT + 0.1;

    if (jump && onGround) {
      velocity.current.y = JUMP_SPEED;
    }

    camera.position.y += velocity.current.y * dt;

    if (camera.position.y < groundY + PLAYER_HEIGHT) {
      camera.position.y = groundY + PLAYER_HEIGHT;
      velocity.current.y = 0;
    }

    if (camera.position.y < -5) {
      camera.position.set(0, 8, 0);
      velocity.current.set(0, 0, 0);
    }

    // Fruit collection
    fruitsRef.current.forEach(fruit => {
      if (fruit.collected) return;
      const dist = camera.position.distanceTo(new THREE.Vector3(...fruit.position));
      if (dist < 1.8) {
        onFruitCollect(fruit.id);
      }
    });
  });

  return <PointerLockControls ref={controlsRef} />;
}
