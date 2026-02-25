import gameBg from '@/assets/game-bg.jpg';
import { FRUIT_CONFIG } from './types';

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${gameBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/80" />

      {/* Floating blocks decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { color: '#4a8c3f', left: '10%', top: '20%', delay: '0s', size: '40px' },
          { color: '#8B6914', left: '80%', top: '15%', delay: '1s', size: '30px' },
          { color: '#707070', left: '15%', top: '70%', delay: '2s', size: '35px' },
          { color: '#6B4226', left: '85%', top: '65%', delay: '0.5s', size: '28px' },
          { color: '#2E7D32', left: '50%', top: '10%', delay: '1.5s', size: '32px' },
        ].map((block, i) => (
          <div
            key={i}
            className="absolute animate-float-block rounded-sm opacity-40"
            style={{
              left: block.left,
              top: block.top,
              width: block.size,
              height: block.size,
              backgroundColor: block.color,
              animationDelay: block.delay,
              boxShadow: `0 0 15px ${block.color}50`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* Title */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-primary text-glow-green tracking-wider">
            VOXEL
          </h1>
          <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-secondary text-glow-orange tracking-wider mt-2">
            FRUITS
          </h1>
        </div>

        {/* Subtitle */}
        <div className="animate-slide-up mt-6" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <p className="font-game text-lg sm:text-xl text-muted-foreground tracking-widest uppercase">
            Minecraft × Blox Fruits
          </p>
        </div>

        {/* Fruit icons */}
        <div className="animate-slide-up flex justify-center gap-4 mt-8" style={{ animationDelay: '0.5s', opacity: 0 }}>
          {Object.entries(FRUIT_CONFIG).map(([key, config]) => (
            <div key={key} className="text-center">
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full mx-auto animate-pulse-glow"
                style={{
                  backgroundColor: config.color,
                  boxShadow: `0 0 12px ${config.color}, 0 0 24px ${config.color}50`,
                }}
              />
              <p className="text-xs font-game text-muted-foreground mt-1.5">{config.name}</p>
            </div>
          ))}
        </div>

        {/* Play button */}
        <div className="animate-slide-up mt-12" style={{ animationDelay: '0.7s', opacity: 0 }}>
          <button
            onClick={onStart}
            className="font-pixel text-sm sm:text-base px-8 py-4 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95"
          >
            ▶ JOGAR
          </button>
        </div>

        {/* Controls info */}
        <div className="animate-slide-up mt-8" style={{ animationDelay: '0.9s', opacity: 0 }}>
          <div className="inline-flex flex-wrap justify-center gap-3 text-xs font-game text-muted-foreground">
            <span className="bg-muted px-2 py-1 rounded">WASD Mover</span>
            <span className="bg-muted px-2 py-1 rounded">Mouse Olhar</span>
            <span className="bg-muted px-2 py-1 rounded">Clique Quebrar</span>
            <span className="bg-muted px-2 py-1 rounded">Espaço Pular</span>
          </div>
        </div>

        <p className="animate-slide-up font-game text-xs text-muted-foreground/50 mt-6" style={{ animationDelay: '1.1s', opacity: 0 }}>
          🖥️ Melhor experiência no Desktop
        </p>
      </div>
    </div>
  );
}
