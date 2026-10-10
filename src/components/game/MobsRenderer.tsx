import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MobData, MOB_CONFIG } from './mobs';
import { World } from './world';
import { AnimalModel, AnimalType, ANIMAL_TYPES } from './AnimalModel';
import { playerPosition, mobRegistry, mobFrozenUntil } from './playerState';
import { WORLD_HALF } from './biomes';


interface MobsRendererProps {
  mobs: MobData[];
  world: World;
  onPlayerDamage: (damage: number) => void;
}

export function MobsRenderer({ mobs, world, onPlayerDamage }: MobsRendererProps) {
  return (
    <>
      {mobs.filter(m => !m.dead).map(mob => (
        <MobMesh key={mob.id} mob={mob} world={world} onPlayerDamage={onPlayerDamage} />
      ))}
    </>
  );
}

function MobMesh({ mob, world, onPlayerDamage }: { mob: MobData; world: World; onPlayerDamage: (damage: number) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const config = MOB_CONFIG[mob.type];
  const walkPhase = useRef(Math.random() * Math.PI * 2);
  const wanderTarget = useRef(new THREE.Vector3(
    mob.position[0] + (Math.random() - 0.5) * 10,
    mob.position[1],
    mob.position[2] + (Math.random() - 0.5) * 10,
  ));
  const wanderTimer = useRef(0);
  const attackCooldown = useRef(0);
  const hurtFlash = useRef(0);
  const moving = useRef(0);
  const isAnimal = ANIMAL_TYPES.includes(mob.type as AnimalType);

  useEffect(() => {
    const g = groupRef.current;
    if (g) mobRegistry.set(mob.id, { pos: g.position, hostile: mob.hostile });
    return () => { mobRegistry.delete(mob.id); };
  }, [mob.id, mob.hostile]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const pos = groupRef.current.position;
    walkPhase.current += dt * config.speed * 3;
    wanderTimer.current += dt;
    attackCooldown.current = Math.max(0, attackCooldown.current - dt);
    hurtFlash.current = Math.max(0, hurtFlash.current - dt);

    const distToPlayer = pos.distanceTo(playerPosition);
    const isGuardian = mob.type === 'guardian';
    const home = mob.home;
    // Poder do Gelo: mob congelado não anda nem ataca
    const frozen = (mobFrozenUntil.get(mob.id) ?? 0) > performance.now();
    // O Guardião só sai atrás do jogador perto da fruta (não persegue pelo mapa todo)
    const farFromHome = !!home && Math.hypot(pos.x - home[0], pos.z - home[2]) > 10;
    const chaseRange = isGuardian ? 12 : 20;

    if (frozen) {
      moving.current = 0;
    } else if (mob.hostile && distToPlayer < chaseRange && !(isGuardian && farFromHome && distToPlayer > 4)) {
      // Chase player
      const dir = new THREE.Vector3().subVectors(playerPosition, pos);
      dir.y = 0;
      dir.normalize();
      pos.x += dir.x * config.speed * dt;
      pos.z += dir.z * config.speed * dt;

      // Face player
      groupRef.current.lookAt(new THREE.Vector3(playerPosition.x, pos.y, playerPosition.z));

      // Attack when close
      if (distToPlayer < 2 && attackCooldown.current <= 0) {
        onPlayerDamage(isGuardian ? 10 : mob.type === 'spider' ? 4 : mob.type === 'skeleton' ? 6 : 5);
        attackCooldown.current = 1.5;
      }
    } else {
      // Wander
      if (wanderTimer.current > 3 + Math.random() * 4) {
        wanderTimer.current = 0;
        // O Guardião fica rondando a fruta
        const cx = home ? home[0] : pos.x, cz = home ? home[2] : pos.z;
        const spread = home ? 5 : 8;
        wanderTarget.current.set(
          cx + (Math.random() - 0.5) * spread,
          pos.y,
          cz + (Math.random() - 0.5) * spread,
        );
      }

      const dir = new THREE.Vector3().subVectors(wanderTarget.current, pos);
      dir.y = 0;
      const walking = dir.length() > 0.5;
      moving.current += ((walking ? 1 : 0) - moving.current) * (1 - Math.exp(-6 * dt));
      if (walking) {
        dir.normalize();
        pos.x += dir.x * config.speed * 0.4 * dt;
        pos.z += dir.z * config.speed * 0.4 * dt;
        groupRef.current.lookAt(new THREE.Vector3(wanderTarget.current.x, pos.y, wanderTarget.current.z));
      }
    }

    // Ground snap (o Guardião da caverna anda no chão da caverna)
    const surfaceY = world.groundHeight(pos.x, pos.z);
    const groundY = home && home[1] < surfaceY - 3 ? world.floorBelow(pos.x, home[1] + 2, pos.z) : surfaceY;
    pos.y = isAnimal ? groundY : groundY + config.bodyScale[1] / 2;

    // Keep in bounds
    pos.x = Math.max(-WORLD_HALF + 2, Math.min(WORLD_HALF - 2, pos.x));
    pos.z = Math.max(-WORLD_HALF + 2, Math.min(WORLD_HALF - 2, pos.z));
  });

  const [bw, bh, bd] = config.bodyScale;
  const isSpider = mob.type === 'spider';
  const headSize = isSpider ? bh * 0.7 : Math.min(bw, bd) * 0.8;
  const legAnim = Math.sin(walkPhase.current) * 0.3;

  if (isAnimal) {
    return (
      <group ref={groupRef} position={mob.position}>
        <AnimalModel type={mob.type as AnimalType} moving={moving} />
      </group>
    );
  }

  return (
    <group ref={groupRef} position={mob.position}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <meshStandardMaterial color={config.color} roughness={0.8} />
      </mesh>

      {/* Head */}
      <mesh position={[0, bh / 2 + headSize / 2, isSpider ? -bd / 2 : 0]} castShadow>
        <boxGeometry args={[headSize, headSize, headSize]} />
        <meshStandardMaterial color={config.color} roughness={0.7} />
      </mesh>

      {/* Eyes */}
      <mesh position={[headSize * 0.2, bh / 2 + headSize / 2, isSpider ? -bd / 2 - headSize / 2 : -headSize / 2 - 0.01]}>
        <boxGeometry args={[headSize * 0.2, headSize * 0.2, 0.05]} />
        <meshStandardMaterial color={config.eyeColor} emissive={mob.hostile ? config.eyeColor : '#000'} emissiveIntensity={mob.hostile ? 0.8 : 0} />
      </mesh>
      <mesh position={[-headSize * 0.2, bh / 2 + headSize / 2, isSpider ? -bd / 2 - headSize / 2 : -headSize / 2 - 0.01]}>
        <boxGeometry args={[headSize * 0.2, headSize * 0.2, 0.05]} />
        <meshStandardMaterial color={config.eyeColor} emissive={mob.hostile ? config.eyeColor : '#000'} emissiveIntensity={mob.hostile ? 0.8 : 0} />
      </mesh>

      {/* Legs */}
      {!isSpider ? (
        <>
          {/* Bipedal legs */}
          <mesh position={[bw * 0.2, -bh / 2 - 0.25, 0]} rotation={[legAnim, 0, 0]} castShadow>
            <boxGeometry args={[bw * 0.35, bh * 0.5, bd * 0.6]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
          <mesh position={[-bw * 0.2, -bh / 2 - 0.25, 0]} rotation={[-legAnim, 0, 0]} castShadow>
            <boxGeometry args={[bw * 0.35, bh * 0.5, bd * 0.6]} />
            <meshStandardMaterial color={config.color} roughness={0.8} />
          </mesh>
        </>
      ) : (
        <>
          {/* Spider legs - 4 pairs */}
          {[-1, 1].map(side => (
            [0, 1, 2, 3].map(i => (
              <mesh
                key={`leg-${side}-${i}`}
                position={[side * (bw / 2 + 0.15), -bh * 0.3, (i - 1.5) * bd * 0.35]}
                rotation={[0, 0, side * (0.6 + Math.sin(walkPhase.current + i) * 0.2)]}
              >
                <boxGeometry args={[0.4, 0.08, 0.08]} />
                <meshStandardMaterial color={config.color} roughness={0.9} />
              </mesh>
            ))
          ))}
        </>
      )}

      {/* Guardião: elmo dourado e ombreiras */}
      {mob.type === 'guardian' && (
        <>
          <mesh position={[0, bh / 2 + headSize + 0.06, 0]}>
            <boxGeometry args={[headSize * 1.25, 0.18, headSize * 1.25]} />
            <meshStandardMaterial color="#ffcc00" emissive="#aa7700" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
          </mesh>
          {[-1, 1].map(side => (
            <mesh key={side} position={[side * (bw / 2 + 0.08), bh / 2 - 0.1, 0]}>
              <boxGeometry args={[0.28, 0.22, bd * 1.1]} />
              <meshStandardMaterial color="#ffcc00" emissive="#aa7700" emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </>
      )}

      {/* Villager hat */}
      {mob.type === 'villager' && (
        <mesh position={[0, bh / 2 + headSize + 0.05, 0]}>
          <boxGeometry args={[headSize * 1.3, 0.15, headSize * 1.3]} />
          <meshStandardMaterial color="#5a3a1a" roughness={0.8} />
        </mesh>
      )}

      {/* Cow spots */}
      {mob.type === 'cow' && (
        <>
          <mesh position={[bw * 0.15, bh * 0.1, -bd / 2 - 0.01]}>
            <boxGeometry args={[0.15, 0.15, 0.02]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
          <mesh position={[-bw * 0.1, -bh * 0.1, bd / 2 + 0.01]}>
            <boxGeometry args={[0.2, 0.12, 0.02]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
        </>
      )}

      {/* Health bar for hostile mobs */}
      {mob.hostile && (mob.health < mob.maxHealth || mob.type === 'guardian') && (
        <group position={[0, bh / 2 + headSize + 0.4, 0]}>
          <mesh>
            <boxGeometry args={[0.8, 0.08, 0.02]} />
            <meshBasicMaterial color="#333" />
          </mesh>
          <mesh position={[(mob.health / mob.maxHealth - 1) * 0.4, 0, 0.01]}>
            <boxGeometry args={[0.8 * (mob.health / mob.maxHealth), 0.06, 0.02]} />
            <meshBasicMaterial color={mob.health / mob.maxHealth > 0.5 ? '#4CAF50' : '#f44336'} />
          </mesh>
        </group>
      )}

    </group>
  );
}
