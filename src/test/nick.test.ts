import { describe, it, expect } from 'vitest';
import { hasBlockedWord, suggestNick, validateNick } from '@/lib/nameFilter';

describe('nick do jogador', () => {
  it.each(['Gustavo', 'MangaNinja42', 'Caio_2', 'abc'])('aceita "%s"', nick => {
    expect(validateNick(nick)).toBeNull();
  });

  it.each([
    ['ab', 'pelo menos'],
    ['NomeMuitoGrandeDemais', 'no máximo'],
    ['Ana Bia', 'sem espaço'],
    ['João', 'sem acento'],
    ['12345', 'uma letra'],
    ['aaaaaa', 'repetidas'],
    ['SouIdiota', 'proibida'],
    ['Admin_1', 'proibida'],
    ['FuckYou', 'proibida'],
  ])('recusa "%s"', (nick, msg) => {
    expect(validateNick(nick)).toContain(msg);
  });

  it('nomes normais não são bloqueados por pedaços de palavrão', () => {
    expect(hasBlockedWord('Marcus')).toBe(false);
    expect(hasBlockedWord('Cassio')).toBe(false);
    expect(hasBlockedWord('Moderna')).toBe(false);
  });

  it('as sugestões de nick são sempre válidas', () => {
    for (let i = 0; i < 300; i++) {
      const n = suggestNick();
      expect(validateNick(n), n).toBeNull();
    }
  });
});
