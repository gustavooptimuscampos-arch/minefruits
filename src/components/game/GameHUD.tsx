import { FRUIT_CONFIG, FruitType, ITEM_CONFIG, ItemType, Item } from './types';

interface GameHUDProps {
  score: number;
  collectedFruits: FruitType[];
  blocksDestroyed: number;
  playerHealth: number;
  hunger: number;
  isNight: boolean;
  mobsKilled: number;
  roomCode?: string;
  playersOnline?: number;
  voxelCoins?: number;
  inventory: {
    items: Item[];
    hotbar: (ItemType | null)[];
    selectedSlot: number;
    setSelectedSlot: (slot: number) => void;
    equippedItem: ItemType | null;
    setHotbar: React.Dispatch<React.SetStateAction<(ItemType | null)[]>>;
  };
  locked?: boolean;
  /** Total de frutas do mapa (antes o HUD mostrava "/10" fixo). */
  totalFruits?: number;
  /** Nome do bioma onde o jogador está (ex.: "🏜️ Deserto"). */
  biome?: string;
  /** Abre o menu de pausa (de lá o jogador pode sair). */
  onPause?: () => void;
}

export function GameHUD({ score, collectedFruits, blocksDestroyed, playerHealth, hunger, isNight, mobsKilled, roomCode, playersOnline, inventory, voxelCoins = 0, locked = false, totalFruits, biome, onPause }: GameHUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/80" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border border-foreground/30 rounded-full" />
      </div>

      {/* Pause button */}
      {onPause && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto hide-on-touch">
          <button
            onClick={onPause}
            className="font-pixel text-[10px] px-3 py-1 bg-muted/80 text-foreground rounded hover:bg-muted transition-colors"
          >
            ESC Pausar
          </button>
        </div>
      )}

      {/* Score & Coins */}
      <div className="absolute top-4 right-4 text-right hud-corner-right">
        <div className="font-pixel text-primary text-lg text-glow-green">{score}</div>
        <div className="text-muted-foreground text-sm font-game mt-1">PONTOS</div>
        <div className="mt-2 bg-secondary/20 backdrop-blur-sm rounded-lg px-3 py-1 border border-secondary/30">
          <span className="font-pixel text-secondary text-sm">🪙 {voxelCoins}</span>
          <span className="text-[10px] font-game text-muted-foreground ml-1">MineCoins</span>
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4 hud-corner-left">
        <div className="bg-background/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50 space-y-1">
          {biome && <div className="text-sm font-game text-foreground">{biome}</div>}
          <div className="text-sm font-game text-muted-foreground">⛏️ Blocos: <span className="text-foreground">{blocksDestroyed}</span></div>
          <div className="text-sm font-game text-muted-foreground">🍎 Frutas: <span className="text-foreground">{collectedFruits.length}{totalFruits ? ` de ${totalFruits}` : ''}</span></div>
          <div className="text-sm font-game text-muted-foreground">💀 Mobs: <span className="text-foreground">{mobsKilled}</span></div>
          <div className="text-sm font-game text-muted-foreground">
            {isNight ? '🌙 Noite' : '☀️ Dia'}
            {isNight && <span className="text-red-400 ml-1 animate-pulse">⚠️ Monstros!</span>}
          </div>
          {roomCode && (
            <div className="text-sm font-game text-muted-foreground">
              👥 Online: <span className="text-foreground">{playersOnline || 1}</span>
              <span className="text-muted-foreground/60 ml-1">({roomCode})</span>
            </div>
          )}
        </div>
      </div>

      {/* Health + Hunger bars */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-52 space-y-1 hud-bars">
        {/* Health */}
        <div className="bg-background/60 backdrop-blur-sm rounded-full border border-border/50 p-1">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-game">❤️</span>
            <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${playerHealth}%`,
                  backgroundColor: playerHealth > 60 ? '#4CAF50' : playerHealth > 30 ? '#FF9800' : '#f44336',
                }}
              />
            </div>
            <span className="text-xs font-game text-foreground">{Math.round(playerHealth)}</span>
          </div>
        </div>
        {/* Hunger */}
        <div className="bg-background/60 backdrop-blur-sm rounded-full border border-border/50 p-1">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-game">🍗</span>
            <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${hunger}%`,
                  backgroundColor: hunger > 60 ? '#8B4513' : hunger > 30 ? '#FF9800' : '#f44336',
                }}
              />
            </div>
            <span className="text-xs font-game text-foreground">{Math.round(hunger)}</span>
          </div>
        </div>
      </div>

      {/* Hotbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex gap-1 bg-background/70 backdrop-blur-sm rounded-lg p-1 border border-border/50">
          {inventory.hotbar.map((item, i) => {
            const isSelected = inventory.selectedSlot === i;
            const config = item ? ITEM_CONFIG[item] : null;
            return (
              <button key={i} onClick={() => inventory.setSelectedSlot(i)}
                className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-all ${
                  isSelected ? 'bg-primary/30 border-2 border-primary scale-110' : 'bg-muted/30 border border-border/30 hover:bg-muted/50'
                }`}
              >
                {config ? <span title={config.label}>{config.emoji}</span> : <span className="text-xs text-muted-foreground/30">{i + 1}</span>}
              </button>
            );
          })}
        </div>
        <div className="text-center mt-1 hide-on-touch">
          <span className="text-[10px] font-game text-muted-foreground">
            {inventory.equippedItem ? ITEM_CONFIG[inventory.equippedItem].label : 'Mão vazia'}
            {' • '}E craftar • B loja • R ranking • V câmera • T chat
          </span>
        </div>
      </div>

      {/* Equipped item indicator */}
      {inventory.equippedItem && (
        <div className="absolute bottom-20 right-4 hide-on-touch">
          <div className="bg-background/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-primary/30">
            <span className="text-sm">{ITEM_CONFIG[inventory.equippedItem].emoji}</span>
            <span className="text-xs font-game text-foreground ml-1">{ITEM_CONFIG[inventory.equippedItem].label}</span>
          </div>
        </div>
      )}

      {/* Death screen */}
      {playerHealth <= 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
          <div className="text-center">
            <p className="font-pixel text-red-400 text-2xl mb-2">VOCÊ MORREU!</p>
            <p className="font-game text-muted-foreground text-sm">Renascendo...</p>
          </div>
        </div>
      )}

      {/* Hunger warning */}
      {hunger <= 20 && hunger > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2">
          <div className="bg-orange-900/40 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-orange-500/30">
            <span className="text-xs font-game text-orange-300 animate-pulse">🍗 Fome! Colete frutas ou mate animais!</span>
          </div>
        </div>
      )}

      {/* Night warning */}
      {isNight && (
        <div className="absolute top-16 right-4 hide-on-touch">
          <div className="bg-red-900/40 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-red-500/30">
            <span className="text-xs font-game text-red-300">🌙 Cuidado com os monstros!</span>
          </div>
        </div>
      )}

      {/* Collected fruits */}
      {collectedFruits.length > 0 && (
        <div className="absolute bottom-28 right-4 flex flex-col gap-1.5 items-end hud-fruits hide-on-touch">
          {collectedFruits.map((type, i) => {
            const config = FRUIT_CONFIG[type];
            return (
              <div key={i} className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-full px-3 py-1 border border-border/50">
                <span className="text-xs font-game text-muted-foreground">{config.power}</span>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}` }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Pointer lock prompt */}
      <PointerLockPrompt locked={locked} />
    </div>
  );
}

function PointerLockPrompt({ locked }: { locked: boolean }) {
  return (
    // Fica acima da mira: antes ficava em cima da barra de itens e escondia os slots
    <div className={`absolute top-[38%] left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity pointer-events-none ${locked ? 'opacity-0' : 'opacity-100'}`}>
      <div className="text-center bg-background/50 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-1.5">
        <p className="font-pixel text-primary text-sm text-glow-green">CLIQUE PARA JOGAR</p>
      </div>
    </div>
  );
}
