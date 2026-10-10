import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RemotePlayer } from './useMultiplayer';
import { SKINS } from './skins';
import { PlayerModel } from './PlayerModel';

interface RemotePlayersRendererProps {
  players: RemotePlayer[];
}

export function RemotePlayersRenderer({ players }: RemotePlayersRendererProps) {
  return (
    <>
      {players.map(player => (
        <RemotePlayerMesh key={player.id} player={player} />
      ))}
    </>
  );
}

function RemotePlayerMesh({ player }: { player: RemotePlayer }) {
  const posRef = useRef(new THREE.Vector3(...player.position));
  const targetPos = useRef(new THREE.Vector3(...player.position));

  // Smooth interpolation
  useFrame(() => {
    targetPos.current.set(...player.position);
    posRef.current.lerp(targetPos.current, 0.15);
  });

  const skin = SKINS.find(s => s.id === player.skinId) || SKINS[0];

  return (
    <group>
      <PlayerModel
        skin={skin}
        position={posRef.current}
        rotation={player.rotation}
        isMoving={player.isMoving}
        isThirdPerson={true}
      />
      {/* Name tag */}
      <group position={[posRef.current.x, posRef.current.y + 0.5, posRef.current.z]}>
        <sprite scale={[2, 0.3, 1]}>
          <spriteMaterial transparent opacity={0.8} color="#000" />
        </sprite>
      </group>
    </group>
  );
}
