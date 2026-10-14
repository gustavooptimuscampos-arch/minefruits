/** Palavras proibidas em nomes e nicks (comparadas como palavras inteiras). */
export const BLOCKED_WORDS = [
  'porra', 'caralho', 'puta', 'merda', 'fdp', 'viado', 'buceta',
  'cu', 'foda', 'cuzao', 'arrombado', 'desgraça', 'vagabundo',
  'idiota', 'imbecil', 'otario', 'babaca', 'bosta', 'piranha',
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'bastard', 'damn',
  'admin', 'moderador', 'mod', 'staff', 'suporte', 'system',
];

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Tem palavra proibida?
 * Palavras curtas só contam inteiras ("Marcus" não é bloqueado por "cu");
 * as longas também contam grudadas ("SouIdiota123").
 * Nicks em CamelCase e com _ são separados em palavras.
 */
export function hasBlockedWord(text: string): boolean {
  const spaced = text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/(\d)([a-zA-Z])/g, '$1 $2');
  const words = plain(spaced).split(/[^a-z0-9]+/).filter(Boolean);
  const joined = words.join('');
  return BLOCKED_WORDS.some(w => {
    const p = plain(w);
    return p.length <= 4 ? words.includes(p) : words.includes(p) || joined.includes(p);
  });
}

export const NICK_MIN = 3;
export const NICK_MAX = 16;

/** Regras do nick: 3 a 16 letras, números ou _, sem palavrão. Devolve o erro ou null. */
export function validateNick(nick: string): string | null {
  const n = nick.trim();
  if (n.length < NICK_MIN) return `O nick precisa ter pelo menos ${NICK_MIN} caracteres`;
  if (n.length > NICK_MAX) return `O nick pode ter no máximo ${NICK_MAX} caracteres`;
  if (!/^[A-Za-z0-9_]+$/.test(n)) return 'Use só letras sem acento, números e _ (sem espaço)';
  if (!/[A-Za-z]/.test(n)) return 'O nick precisa ter pelo menos uma letra';
  if (/(.)\1{3,}/.test(n)) return 'Muitas letras repetidas seguidas';
  if (hasBlockedWord(n)) return '⚠️ Esse nick tem uma palavra proibida';
  return null;
}

const NICK_A = ['Manga', 'Banana', 'Uva', 'Kiwi', 'Melancia', 'Abacaxi', 'Cereja', 'Coco', 'Limao', 'Morango', 'Pitaya', 'Caju'];
const NICK_B = ['Veloz', 'Ninja', 'Mestre', 'Gamer', 'Lendario', 'Bravo', 'Turbo', 'Sombrio', 'Dourado', 'Explorador', 'Minerador', 'Pirata'];

/** Sugestão de nick aleatório (ex.: MangaNinja42). */
export function suggestNick(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const base = pick(NICK_A) + pick(NICK_B);
  return (base.slice(0, 13) + Math.floor(10 + Math.random() * 990)).slice(0, NICK_MAX);
}
