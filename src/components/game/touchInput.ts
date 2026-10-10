/** Celular/tablet (tela de toque sem mouse). */
export const isTouchDevice =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Estado dos controles de toque, lido pelo Player a cada quadro.
 * Os botões e o joystick escrevem aqui; o Player consome.
 */
export const touchInput = {
  /** Joystick: x = direita(+)/esquerda(-), y = frente(-)/trás(+), entre -1 e 1. */
  moveX: 0,
  moveY: 0,
  /** Quanto o dedo arrastou para olhar desde o último quadro (pixels). */
  lookDX: 0,
  lookDY: 0,
  jump: false,
  sprint: false,
  /** Pedidos de ataque ainda não processados. */
  attacks: 0,
};

/** Simula uma tecla do teclado, para reaproveitar os atalhos do jogo (E, B, R, V, T). */
export function pressKey(code: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}
