import { useState } from 'react';
import gameBg from '@/assets/game-bg.jpg';
import { FRUIT_CONFIG } from './types';
import { SKINS, SkinData } from './skins';

interface StartScreenProps {
  onStart: (skin: SkinData, mode: 'single' | 'multi') => void;
  customSkins?: SkinData[];
  onCreateSkin?: () => void;
}

export function StartScreen({ onStart, customSkins = [], onCreateSkin }: StartScreenProps) {
  const allSkins = [...SKINS, ...customSkins];
  const [selectedSkin, setSelectedSkin] = useState(allSkins[0]);
  const [showSkins, setShowSkins] = useState(false);

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-background short:py-3">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url(${gameBg})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/25 via-transparent to-background/20" />

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
      <div className="relative z-10 text-center px-4 w-full max-w-2xl short:max-w-4xl">
        {!showSkins ? (
          <>
            {/* Title */}
            <div className="animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
              <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl short:text-2xl text-primary text-glow-green tracking-wider">
                MINE
              </h1>
              <h1 className="font-pixel text-3xl sm:text-5xl md:text-6xl short:text-2xl text-secondary text-glow-orange tracking-wider mt-2 short:mt-1">
                FRUITS
              </h1>
            </div>

            <div className="animate-slide-up mt-6 short:mt-2" style={{ animationDelay: '0.3s', opacity: 0 }}>
              <p className="font-game text-lg sm:text-xl text-muted-foreground tracking-widest uppercase">
                Minecraft × Blox Fruits
              </p>
            </div>

            {/* Fruit icons */}
            <div className="animate-slide-up flex justify-center gap-4 mt-8 short:mt-3" style={{ animationDelay: '0.5s', opacity: 0 }}>
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
            <div className="animate-slide-up mt-12 short:mt-4" style={{ animationDelay: '0.7s', opacity: 0 }}>
              <button
                onClick={() => setShowSkins(true)}
                className="font-pixel text-sm sm:text-base px-8 py-4 short:py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95"
              >
                ▶ JOGAR
              </button>
            </div>

            {/* Controls */}
            <div className="animate-slide-up mt-8 short:mt-3" style={{ animationDelay: '0.9s', opacity: 0 }}>
              <div className="inline-flex flex-wrap justify-center gap-3 text-xs font-game text-muted-foreground touch-only">
                <span className="bg-muted px-2 py-1 rounded">🕹️ Joystick Andar</span>
                <span className="bg-muted px-2 py-1 rounded">👆 Arrastar Olhar</span>
                <span className="bg-muted px-2 py-1 rounded">⚔️ Atacar</span>
                <span className="bg-muted px-2 py-1 rounded">⬆️ Pular</span>
                <span className="bg-muted px-2 py-1 rounded">📱 Celular deitado</span>
              </div>
              <div className="inline-flex flex-wrap justify-center gap-3 text-xs font-game text-muted-foreground hide-on-touch">
                <span className="bg-muted px-2 py-1 rounded">WASD Mover</span>
                <span className="bg-muted px-2 py-1 rounded">Mouse Olhar</span>
                <span className="bg-muted px-2 py-1 rounded">Clique Atacar</span>
                <span className="bg-muted px-2 py-1 rounded">Espaço Pular</span>
                <span className="bg-muted px-2 py-1 rounded">V Câmera</span>
              </div>
            </div>

            {/* Identity warning */}
            <div className="animate-slide-up mt-6 short:mt-3" style={{ animationDelay: '1.1s', opacity: 0 }}>
              <div className="inline-block bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
                <p className="text-xs font-game text-destructive">
                  ⚠️ PROIBIDO IDENTIDADES FALSAS — Pena de multa de R$ 3.000
                </p>
                <p className="text-[10px] font-game text-destructive/80 mt-1">
                  Se não pagar no prazo, será obrigatório desinstalar o jogo.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Skin Selection */}
            <h2 className="font-pixel text-xl sm:text-2xl text-primary text-glow-green mb-8 short:mb-3 short:text-base">
              ESCOLHA SUA SKIN
            </h2>

            <div className="grid grid-cols-4 short:grid-cols-9 gap-3 sm:gap-4 short:gap-2 mb-8 short:mb-3">
              {allSkins.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSkin(s)}
                  className={`
                    flex flex-col items-center gap-2 short:gap-1 p-3 short:p-1.5 rounded-lg border-2 transition-all duration-200
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
              {/* Create skin button */}
              {onCreateSkin && (
                <button
                  onClick={onCreateSkin}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed border-border/50 bg-background/20 hover:border-primary/50 hover:bg-background/40 transition-all duration-200"
                >
                  <div className="relative w-10 h-16 sm:w-12 sm:h-20 flex items-center justify-center">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <span className="text-xs font-game text-muted-foreground">Criar Skin</span>
                </button>
              )}
            </div>

            {/* Selected skin info */}
            <div className="mb-6 short:mb-2">
              <p className="font-game text-lg text-foreground">{selectedSkin.name}</p>
            </div>

            <div className="flex flex-col short:flex-row short:justify-center gap-3 items-center">
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowSkins(false)}
                  className="font-pixel text-xs px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  ← VOLTAR
                </button>
                <button
                  onClick={() => onStart(selectedSkin, 'single')}
                  className="font-pixel text-sm px-8 py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95"
                >
                  ▶ SOLO
                </button>
              </div>
              <button
                onClick={() => onStart(selectedSkin, 'multi')}
                className="font-pixel text-sm px-8 py-3 bg-secondary text-secondary-foreground rounded-lg box-glow-orange hover:scale-105 transition-transform duration-200 active:scale-95"
              >
                👥 MULTIPLAYER
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
