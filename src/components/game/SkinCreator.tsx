import { useState } from 'react';
import { SkinData } from './skins';

interface SkinCreatorProps {
  onSave: (skin: SkinData) => void;
  onBack: () => void;
}

const COLOR_PRESETS = [
  '#c4956a', '#d4a574', '#8d5524', '#3a2a1a', '#f5d0a9',
  '#cc0000', '#ff6600', '#ffd700', '#2d5a27', '#00a2e8',
  '#3344aa', '#3f48cc', '#8B00FF', '#1a1a1a', '#ffffff',
  '#ff69b4', '#4a8c3f', '#8a6a3a', '#cc8800', '#707070',
];

const PARTS = [
  { key: 'head', label: '🧑 Cabeça' },
  { key: 'body', label: '👕 Corpo' },
  { key: 'arms', label: '💪 Braços' },
  { key: 'legs', label: '👖 Pernas' },
  { key: 'eyes', label: '👀 Olhos' },
] as const;

type PartKey = typeof PARTS[number]['key'];

export function SkinCreator({ onSave, onBack }: SkinCreatorProps) {
  const [name, setName] = useState('Minha Skin');
  const [colors, setColors] = useState({
    head: '#c4956a',
    body: '#00a2e8',
    arms: '#c4956a',
    legs: '#3f48cc',
    eyes: '#3a2a1a',
  });
  const [hat, setHat] = useState(false);
  const [hatColor, setHatColor] = useState('#cc8800');
  const [cape, setCape] = useState(false);
  const [capeColor, setCapeColor] = useState('#cc0000');
  const [activePart, setActivePart] = useState<PartKey | 'hat' | 'cape'>('head');

  const trimmedName = name.trim();

  const handleSave = () => {
    if (!trimmedName) return;
    const skin: SkinData = {
      id: 'custom-' + Date.now(),
      name: trimmedName,
      ...colors,
      hat: hat ? hatColor : undefined,
      cape: cape ? capeColor : undefined,
      label: '🎨 ' + trimmedName,
    };
    onSave(skin);
  };

  const activeColor = activePart === 'hat' ? hatColor : activePart === 'cape' ? capeColor : colors[activePart];

  const setActiveColor = (color: string) => {
    if (activePart === 'hat') setHatColor(color);
    else if (activePart === 'cape') setCapeColor(color);
    else setColors(prev => ({ ...prev, [activePart]: color }));
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="relative z-10 w-full max-w-md">
        <h2 className="font-pixel text-xl sm:text-2xl text-primary text-glow-green mb-6 text-center">
          🎨 CRIAR SKIN
        </h2>

        {/* Name input */}
        <div className="mb-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={16}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 font-game text-sm text-foreground focus:outline-none focus:border-primary"
            placeholder="Nome da skin"
          />
        </div>

        <div className="flex gap-4">
          {/* Preview */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative w-20 h-36 bg-muted/20 rounded-lg border border-border/30 flex items-center justify-center">
              <div className="relative w-14 h-28">
                {/* Hat */}
                {hat && (
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-2.5 rounded-sm cursor-pointer"
                    style={{ backgroundColor: hatColor, outline: activePart === 'hat' ? '2px solid hsl(var(--primary))' : 'none' }}
                    onClick={() => setActivePart('hat')}
                  />
                )}
                {/* Head */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded-sm cursor-pointer"
                  style={{ backgroundColor: colors.head, outline: activePart === 'head' ? '2px solid hsl(var(--primary))' : 'none' }}
                  onClick={() => setActivePart('head')}
                >
                  <div className="absolute top-2.5 left-1.5 w-1.5 h-1 rounded-sm" style={{ backgroundColor: colors.eyes }} />
                  <div className="absolute top-2.5 right-1.5 w-1.5 h-1 rounded-sm" style={{ backgroundColor: colors.eyes }} />
                </div>
                {/* Body */}
                <div
                  className="absolute top-8 left-1/2 -translate-x-1/2 w-8 h-10 rounded-sm cursor-pointer"
                  style={{ backgroundColor: colors.body, outline: activePart === 'body' ? '2px solid hsl(var(--primary))' : 'none' }}
                  onClick={() => setActivePart('body')}
                />
                {/* Cape */}
                {cape && (
                  <div
                    className="absolute top-8 left-1/2 -translate-x-1/2 w-7 h-9 rounded-sm cursor-pointer translate-x-0"
                    style={{
                      backgroundColor: capeColor,
                      outline: activePart === 'cape' ? '2px solid hsl(var(--primary))' : 'none',
                      transform: 'translateX(-50%) translateZ(-1px)',
                      zIndex: -1,
                    }}
                    onClick={() => setActivePart('cape')}
                  />
                )}
                {/* Arms */}
                <div
                  className="absolute top-8 -left-1 w-3 h-9 rounded-sm cursor-pointer"
                  style={{ backgroundColor: colors.arms, outline: activePart === 'arms' ? '2px solid hsl(var(--primary))' : 'none' }}
                  onClick={() => setActivePart('arms')}
                />
                <div
                  className="absolute top-8 -right-1 w-3 h-9 rounded-sm cursor-pointer"
                  style={{ backgroundColor: colors.arms, outline: activePart === 'arms' ? '2px solid hsl(var(--primary))' : 'none' }}
                  onClick={() => setActivePart('arms')}
                />
                {/* Legs */}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5 cursor-pointer"
                  onClick={() => setActivePart('legs')}
                >
                  <div className="w-3 h-7 rounded-sm" style={{ backgroundColor: colors.legs, outline: activePart === 'legs' ? '2px solid hsl(var(--primary))' : 'none' }} />
                  <div className="w-3 h-7 rounded-sm" style={{ backgroundColor: colors.legs, outline: activePart === 'legs' ? '2px solid hsl(var(--primary))' : 'none' }} />
                </div>
              </div>
            </div>
            <p className="text-xs font-game text-muted-foreground mt-2">Clique para editar</p>
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-3">
            {/* Part selector */}
            <div className="flex flex-wrap gap-1">
              {PARTS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setActivePart(p.key)}
                  className={`text-xs font-game px-2 py-1 rounded transition-colors ${
                    activePart === p.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Accessories */}
            <div className="flex gap-2">
              <button
                onClick={() => { setHat(!hat); if (!hat) setActivePart('hat'); }}
                className={`text-xs font-game px-2 py-1 rounded transition-colors ${
                  hat ? 'bg-secondary text-secondary-foreground' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                🎩 Chapéu
              </button>
              <button
                onClick={() => { setCape(!cape); if (!cape) setActivePart('cape'); }}
                className={`text-xs font-game px-2 py-1 rounded transition-colors ${
                  cape ? 'bg-secondary text-secondary-foreground' : 'bg-muted/50 text-muted-foreground'
                }`}
              >
                🦸 Capa
              </button>
            </div>

            {/* Color picker */}
            <div>
              <p className="text-xs font-game text-muted-foreground mb-1.5">
                Cor: {activePart === 'hat' ? '🎩 Chapéu' : activePart === 'cape' ? '🦸 Capa' : PARTS.find(p => p.key === activePart)?.label}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    className="w-8 h-8 rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: activeColor === c ? 'hsl(var(--primary))' : 'transparent',
                    }}
                  />
                ))}
              </div>
              {/* Custom color */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={activeColor}
                  onChange={e => setActiveColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="text-xs font-game text-muted-foreground">Cor personalizada</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={onBack}
            className="font-pixel text-xs px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            ← VOLTAR
          </button>
          <button
            onClick={handleSave}
            disabled={!trimmedName}
            title={trimmedName ? undefined : 'Dê um nome para a skin'}
            className="font-pixel text-sm px-8 py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform duration-200 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            ✓ SALVAR SKIN
          </button>
        </div>
      </div>
    </div>
  );
}
