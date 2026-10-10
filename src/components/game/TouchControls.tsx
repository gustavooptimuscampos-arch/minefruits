import { useEffect, useRef } from 'react';
import { touchInput, pressKey } from './touchInput';

const STICK_RADIUS = 48;
const LOOK_TAP_MS = 220;
const LOOK_TAP_MOVE = 10;
const ATTACK_REPEAT_MS = 350;

/**
 * Controles de celular:
 * - joystick à esquerda para andar (empurrar até a borda = correr)
 * - arrastar o dedo na tela para olhar; um toque rápido ataca
 * - botões de atacar e pular à direita, e um menu no topo
 */
export function TouchControls({ onExit }: { onExit?: () => void }) {
  useEffect(() => () => {
    // Ao sair do jogo, solta tudo
    Object.assign(touchInput, { moveX: 0, moveY: 0, lookDX: 0, lookDY: 0, jump: false, sprint: false, attacks: 0 });
  }, []);

  return (
    <div className="absolute inset-0 select-none touch-none" style={{ WebkitTouchCallout: 'none' }}>
      <LookArea />
      <Joystick />
      <ActionButtons />
      <MenuBar onExit={onExit} />
      <RotateHint />
    </div>
  );
}

/** Área da tela inteira: arrastar = olhar, tocar = atacar. */
function LookArea() {
  const pointers = useRef(new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>());

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 5 }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      }}
      onPointerMove={(e) => {
        const p = pointers.current.get(e.pointerId);
        if (!p) return;
        touchInput.lookDX += e.clientX - p.x;
        touchInput.lookDY += e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;
      }}
      onPointerUp={(e) => {
        const p = pointers.current.get(e.pointerId);
        pointers.current.delete(e.pointerId);
        if (!p) return;
        const quick = performance.now() - p.t < LOOK_TAP_MS;
        const still = Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < LOOK_TAP_MOVE;
        if (quick && still) touchInput.attacks++;
      }}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
    />
  );
}

function Joystick() {
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });

  const update = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
    touchInput.moveX = dx / STICK_RADIUS;
    touchInput.moveY = dy / STICK_RADIUS;
    touchInput.sprint = Math.min(len, STICK_RADIUS) / STICK_RADIUS > 0.92;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  return (
    <div
      className="absolute flex items-center justify-center rounded-full bg-background/30 border-2 border-foreground/25 backdrop-blur-sm"
      style={{ zIndex: 20, width: 132, height: 132, left: 'max(20px, env(safe-area-inset-left))', bottom: 20 }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        const r = e.currentTarget.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        update(e.clientX - center.current.x, e.clientY - center.current.y);
      }}
      onPointerMove={(e) => {
        if (active.current !== e.pointerId) return;
        update(e.clientX - center.current.x, e.clientY - center.current.y);
      }}
      onPointerUp={(e) => { if (active.current === e.pointerId) { active.current = null; update(0, 0); } }}
      onPointerCancel={(e) => { if (active.current === e.pointerId) { active.current = null; update(0, 0); } }}
    >
      <div ref={knob} className="w-14 h-14 rounded-full bg-foreground/50 border-2 border-foreground/70 shadow-lg pointer-events-none" />
      <span className="absolute -top-5 text-[10px] font-game text-foreground/60 pointer-events-none">andar • borda = correr</span>
    </div>
  );
}

function ActionButtons() {
  const repeat = useRef<number | null>(null);

  const stopAttack = () => {
    if (repeat.current !== null) { window.clearInterval(repeat.current); repeat.current = null; }
  };
  useEffect(() => stopAttack, []);

  const round = 'rounded-full flex items-center justify-center border-2 shadow-lg active:scale-90 transition-transform';

  return (
    <div
      className="absolute"
      style={{ zIndex: 20, right: 'max(20px, env(safe-area-inset-right))', bottom: 20, width: 168, height: 150 }}
    >
      {/* Atacar / quebrar (segurar = continua atacando) */}
      <button
        aria-label="Atacar"
        className={`${round} absolute bottom-0 left-0 w-20 h-20 text-3xl bg-red-600/60 border-red-300/70`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          touchInput.attacks++;
          stopAttack();
          repeat.current = window.setInterval(() => { touchInput.attacks++; }, ATTACK_REPEAT_MS);
        }}
        onPointerUp={stopAttack}
        onPointerCancel={stopAttack}
        onContextMenu={(e) => e.preventDefault()}
      >
        ⚔️
      </button>
      {/* Pular */}
      <button
        aria-label="Pular"
        className={`${round} absolute top-0 right-0 w-16 h-16 text-2xl bg-primary/60 border-primary-foreground/60`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); touchInput.jump = true; }}
        onPointerUp={() => { touchInput.jump = false; }}
        onPointerCancel={() => { touchInput.jump = false; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        ⬆️
      </button>
    </div>
  );
}

function MenuBar({ onExit }: { onExit?: () => void }) {
  const items: [string, string, string][] = [
    ['🎒', 'Craftar', 'KeyE'],
    ['🛒', 'Loja', 'KeyB'],
    ['🏆', 'Ranking', 'KeyR'],
    ['🎥', 'Câmera', 'KeyV'],
    ['💬', 'Chat', 'KeyT'],
  ];
  const btn = 'h-9 min-w-9 px-2 rounded-lg bg-background/60 backdrop-blur-sm border border-border/60 text-base active:scale-90 transition-transform';
  return (
    <div className="absolute left-1/2 -translate-x-1/2 flex gap-1.5" style={{ zIndex: 20, top: 'max(8px, env(safe-area-inset-top))' }}>
      {onExit && (
        <button aria-label="Pausar" onClick={onExit} className={`${btn} font-pixel text-[9px]`}>
          ⏸
        </button>
      )}
      {items.map(([icon, label, code]) => (
        <button key={code} aria-label={label} title={label} onClick={() => pressKey(code)} className={btn}>
          {icon}
        </button>
      ))}
    </div>
  );
}

/** Em pé o jogo fica apertado: pede para deitar o celular. */
function RotateHint() {
  return (
    <div className="fixed inset-0 hidden portrait:flex flex-col items-center justify-center gap-4 bg-background/95 text-center p-6" style={{ zIndex: 200 }}>
      <div className="text-6xl animate-pulse">📱↪️</div>
      <p className="font-pixel text-sm text-primary leading-relaxed">Gire o celular<br />para jogar</p>
      <p className="font-game text-muted-foreground">O MineFruits é jogado com o celular deitado.</p>
    </div>
  );
}
