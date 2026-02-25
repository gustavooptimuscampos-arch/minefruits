import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlockType, Fruit } from './types';
import { getGroundHeight } from './terrainGenerator';

interface PlayerProps {
  blocks: Record<string, BlockType>;
  fruits: Fruit[];
  onBlockBreak: (key: string) => void;
  onFruitCollect: (id: string) => void;
}

export function Player({ blocks, fruits, onBlockBreak, onFruitCollect }: PlayerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const moveState = useRef({ forward: false, backward: false, left: false, right: false, jump: false });
  const blocksRef = useRef(blocks);
  const fruitsRef = useRef(fruits);
  blocksRef.current = blocks;
  fruitsRef.current = fruits;

  const SPEED = 6;
  const JUMP_SPEED = 7;
  const GRAVITY = 18;
  const PLAYER_HEIGHT = 1.7;

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

  // Block breaking on click
  useEffect(() => {
    const onClick = () => {
      if (!document.pointerLockElement) return;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
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
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [camera, onBlockBreak]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { forward, backward, left, right, jump } = moveState.current;
    const currentBlocks = blocksRef.current;

    // Camera direction (horizontal)
    const forwardDir = new THREE.Vector3();
    camera.getWorldDirection(forwardDir);
    forwardDir.y = 0;
    forwardDir.normalize();

    const rightDir = new THREE.Vector3();
    rightDir.crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

    // Movement
    const moveDir = new THREE.Vector3();
    if (forward) moveDir.add(forwardDir);
    if (backward) moveDir.sub(forwardDir);
    if (right) moveDir.add(rightDir);
    if (left) moveDir.sub(rightDir);
    if (moveDir.length() > 0) moveDir.normalize();

    camera.position.x += moveDir.x * SPEED * dt;
    camera.position.z += moveDir.z * SPEED * dt;

    // Gravity
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

    // Prevent falling into void
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
