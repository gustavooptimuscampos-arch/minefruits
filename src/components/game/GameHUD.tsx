import { Fruit, FRUIT_CONFIG, FruitType } from './types';

interface GameHUDProps {
  score: number;
  collectedFruits: FruitType[];
  blocksDestroyed: number;
}

export function GameHUD({ score, collectedFruits, blocksDestroyed }: GameHUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-1.5 h-1.5 rounded-full bg-foreground/80" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border border-foreground/30 rounded-full" />
      </div>

      {/* Score */}
      <div className="absolute top-4 right-4 text-right">
        <div className="font-pixel text-primary text-lg text-glow-green">{score}</div>
        <div className="text-muted-foreground text-sm font-game mt-1">PONTOS</div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4">
        <div className="bg-background/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50">
          <div className="text-sm font-game text-muted-foreground">⛏️ Blocos: <span className="text-foreground">{blocksDestroyed}</span></div>
          <div className="text-sm font-game text-muted-foreground">🍎 Frutas: <span className="text-foreground">{collectedFruits.length}/10</span></div>
        </div>
      </div>

      {/* Collected fruits */}
      {collectedFruits.length > 0 && (
        <div className="absolute bottom-16 right-4 flex flex-col gap-1.5 items-end">
          {collectedFruits.map((type, i) => {
            const config = FRUIT_CONFIG[type];
            return (
              <div
                key={i}
                className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-full px-3 py-1 border border-border/50"
              >
                <span className="text-xs font-game text-muted-foreground">{config.power}</span>
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}` }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
        <div className="bg-background/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-border/50">
          <span className="text-xs font-game text-muted-foreground">
            WASD mover • Mouse olhar • Clique quebrar • Espaço pular • ESC sair
          </span>
        </div>
      </div>

      {/* Pointer lock prompt */}
      <PointerLockPrompt />
    </div>
  );
}

function PointerLockPrompt() {
  return (
    <div id="pointer-lock-prompt" className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity pointer-events-none opacity-0">
      <div className="text-center">
        <p className="font-pixel text-primary text-sm text-glow-green">CLIQUE PARA JOGAR</p>
      </div>
    </div>
  );
}
