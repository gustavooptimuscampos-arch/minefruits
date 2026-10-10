/**
 * true quando o jogador está digitando num campo de texto (chat, nome, etc.).
 * Todo atalho global do jogo deve ignorar o evento nesse caso.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}
