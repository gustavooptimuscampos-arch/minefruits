import { useEffect, useState } from 'react';
import gameBg from '@/assets/game-bg.jpg';
import { NICK_MAX, suggestNick, validateNick } from '@/lib/nameFilter';
import type { Social } from '@/hooks/useSocial';

interface NickSetupProps {
  social: Social;
  /** Trocando um nick que já existe (mostra "Cancelar"). */
  current?: string | null;
  onDone: () => void;
  onCancel?: () => void;
  /** E-mail da conta: aparece antes do nick, para o jogador conferir em qual conta entrou. */
  email?: string | null;
  /** "Não é você?": sai da conta para entrar com outra. */
  onLogout?: () => void;
}

/** Escolha do nick: o nome que os outros jogadores veem (o nome real fica escondido). */
export function NickSetup({ social, current, onDone, onCancel, email, onLogout }: NickSetupProps) {
  const [nick, setNick] = useState(current ?? '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { isNickFree } = social;

  const problem = nick ? validateNick(nick) : null;

  // Verifica se o nick está livre enquanto digita
  useEffect(() => {
    setError('');
    if (!nick || problem || nick === current) { setStatus('idle'); return; }
    setStatus('checking');
    const id = setTimeout(async () => {
      const free = await isNickFree(nick);
      setStatus(free === null ? 'idle' : free ? 'free' : 'taken');
    }, 400);
    return () => clearTimeout(id);
  }, [nick, problem, current, isNickFree]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const result = await social.saveNick(nick);
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.error);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background" data-testid="nick-setup">
      <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${gameBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/80" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Identificação da conta (e-mail) antes de escolher o nick */}
        {email && (
          <div className="mb-5 rounded-lg bg-muted/60 border border-border px-4 py-3 text-center" data-testid="account-email">
            <p className="font-game text-[11px] text-muted-foreground">Você entrou com o e-mail</p>
            <p className="font-game text-sm text-foreground break-all">📧 {email}</p>
            {onLogout && (
              <button type="button" onClick={onLogout} className="mt-1 font-game text-[11px] text-primary underline">
                Não é você? Entrar com outra conta
              </button>
            )}
          </div>
        )}

        <h1 className="font-pixel text-xl sm:text-2xl text-primary text-glow-green text-center mb-2">
          {current ? 'TROCAR NICK' : 'CRIE SEU NICK'}
        </h1>
        <p className="text-center font-game text-sm text-muted-foreground mb-6">
          É o nome que os outros jogadores veem e que seus amigos usam para te adicionar.
          Seu nome real fica escondido.
        </p>

        <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-pixel text-sm text-muted-foreground">@</span>
              <input
                autoFocus
                aria-label="Nick"
                value={nick}
                maxLength={NICK_MAX}
                onChange={e => setNick(e.target.value.replace(/\s/g, ''))}
                placeholder="SeuNick123"
                className="w-full pl-8 pr-3 py-3 rounded-lg bg-muted border border-border text-foreground font-game text-base focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setNick(suggestNick())}
              title="Sugerir um nick"
              className="px-4 rounded-lg bg-muted border border-border font-game text-sm hover:bg-muted/80"
            >
              🎲
            </button>
          </div>

          <p className="min-h-[1.25rem] font-game text-xs">
            {problem ? <span className="text-red-300">{problem}</span>
              : status === 'checking' ? <span className="text-muted-foreground">Verificando...</span>
              : status === 'free' ? <span className="text-green-400">✅ Nick disponível!</span>
              : status === 'taken' ? <span className="text-red-300">😕 Esse nick já é de outro jogador</span>
              : <span className="text-muted-foreground">3 a 16 letras, números ou _ · toque em 🎲 para uma ideia</span>}
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-game text-red-300">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!nick || !!problem || status === 'taken' || status === 'checking' || saving}
            className="w-full font-pixel text-sm py-4 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? 'Salvando...' : current ? '✔ SALVAR NICK' : '✔ USAR ESTE NICK'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="w-full font-pixel text-xs py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80">
              ← CANCELAR
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
