import { useState } from 'react';
import gameBg from '@/assets/game-bg.jpg';
import { FRUIT_CONFIG } from './types';
import { SKINS, SkinData } from './skins';

interface StartScreenProps {
  onStart: (skin: SkinData) => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [selectedSkin, setSelectedSkin] = useState(SKINS[0]);
  const [showSkins, setShowSkins] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${gameBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/80" />

      {/* Floating blocks */}
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
              left: block.left, top: block.top,
              width: block.size, height: block.size,
              backgroundColor: block.color,
              animationDelay: block.delay,
              boxShadow: `0 0 15px ${block.color}50`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 w-full max-w-2xl">
        {!showSkins ? (
          <>
            {/* Title */}
            <div className="animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
              <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-primary text-glow-green tracking-wider">
                VOXEL
              </h1>
              <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl text-secondary text-glow-orange tracking-wider mt-2">
                FRUITS
              </h1>
            </div>

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
                onClick={() => setShowSkins(true)}
                className="font-pixel text-sm sm:text-base px-8 py-4 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95"
              >
                ▶ JOGAR
              </button>
            </div>

            {/* Controls */}
            <div className="animate-slide-up mt-8" style={{ animationDelay: '0.9s', opacity: 0 }}>
              <div className="inline-flex flex-wrap justify-center gap-3 text-xs font-game text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">WASD Mover</span>
                <span className="bg-muted px-2 py-1 rounded">Mouse Olhar</span>
                <span className="bg-muted px-2 py-1 rounded">Clique Atacar</span>
                <span className="bg-muted px-2 py-1 rounded">Espaço Pular</span>
                <span className="bg-muted px-2 py-1 rounded">V Câmera</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Skin Selection */}
            <h2 className="font-pixel text-xl sm:text-2xl text-primary text-glow-green mb-8">
              ESCOLHA SUA SKIN
            </h2>

            <div className="grid grid-cols-4 gap-3 sm:gap-4 mb-8">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSkin(s)}
                  className={`
                    flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200
                    ${selectedSkin.id === s.id
                      ? 'border-primary bg-primary/20 scale-105'
                      : 'border-border/50 bg-background/40 hover:border-primary/50 hover:bg-background/60'
                    }
                  `}
                >
                  {/* Mini skin preview */}
                  <div className="relative w-10 h-16 sm:w-12 sm:h-20">
                    {/* Head */}
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-sm"
                      style={{ backgroundColor: s.head }}
                    >
                      {/* Eyes */}
                      <div className="absolute top-1.5 left-1 w-1 h-0.5 rounded-sm" style={{ backgroundColor: s.eyes }} />
                      <div className="absolute top-1.5 right-1 w-1 h-0.5 rounded-sm" style={{ backgroundColor: s.eyes }} />
                    </div>
                    {/* Hat */}
                    {s.hat && (
                      <div
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1.5 sm:w-7 rounded-sm"
                        style={{ backgroundColor: s.hat }}
                      />
                    )}
                    {/* Body */}
                    <div
                      className="absolute top-5 sm:top-6 left-1/2 -translate-x-1/2 w-5 h-6 sm:w-6 sm:h-7 rounded-sm"
                      style={{ backgroundColor: s.body }}
                    />
                    {/* Arms */}
                    <div
                      className="absolute top-5 sm:top-6 -left-0 w-1.5 h-5 sm:w-2 sm:h-6 rounded-sm"
                      style={{ backgroundColor: s.arms }}
                    />
                    <div
                      className="absolute top-5 sm:top-6 -right-0 w-1.5 h-5 sm:w-2 sm:h-6 rounded-sm"
                      style={{ backgroundColor: s.arms }}
                    />
                    {/* Legs */}
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5"
                    >
                      <div className="w-2 h-4 sm:w-2.5 sm:h-5 rounded-sm" style={{ backgroundColor: s.legs }} />
                      <div className="w-2 h-4 sm:w-2.5 sm:h-5 rounded-sm" style={{ backgroundColor: s.legs }} />
                    </div>
                  </div>
                  <span className="text-xs font-game text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Selected skin info */}
            <div className="mb-6">
              <p className="font-game text-lg text-foreground">{selectedSkin.name}</p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowSkins(false)}
                className="font-pixel text-xs px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                ← VOLTAR
              </button>
              <button
                onClick={() => onStart(selectedSkin)}
                className="font-pixel text-sm px-8 py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95"
              >
                ▶ INICIAR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
