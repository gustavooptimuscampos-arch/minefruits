import { useEffect, useState } from 'react';
import type { Friend, Social } from '@/hooks/useSocial';
import { joinRoomByCode } from '@/lib/rooms';
import { isTypingTarget } from './keyboard';

interface FriendsPanelProps {
  social: Social | null;
  /** Visitante: amigos só com conta. */
  onCreateAccount?: () => void;
  onChangeNick?: () => void;
  /** Entrar na sala de um amigo (já validada). */
  onJoinRoom: (code: string) => void;
  onClose: () => void;
}

/** Lista de amigos, pedidos de amizade e "Entrar" na sala de quem está jogando. */
export function FriendsPanel({ social, onCreateAccount, onChangeNick, onJoinRoom, onClose }: FriendsPanelProps) {
  const [addNick, setAddNick] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Digitando o nick: o 1º ESC só sai do campo; o 2º fecha o painel
      if (isTypingTarget(e.target)) (e.target as HTMLElement).blur();
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = async () => {
    if (!social || busy) return;
    setBusy(true);
    const r = await social.sendRequest(addNick);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.message ?? 'Pronto!' } : { ok: false, text: r.error });
    if (r.ok) setAddNick('');
  };

  const join = async (f: Friend) => {
    if (!f.room || busy) return;
    setBusy(true);
    const r = await joinRoomByCode(f.room);
    setBusy(false);
    if (r.ok) onJoinRoom(r.code);
    else setMsg({ ok: false, text: r.error });
  };

  const copyNick = () => {
    if (social?.nick) navigator.clipboard?.writeText(social.nick).then(() => setMsg({ ok: true, text: '📋 Nick copiado! Mande para seus amigos' })).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Amigos"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-card border border-border p-4 sm:p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-base text-primary">👥 AMIGOS</h2>
          <button onClick={onClose} aria-label="Fechar" className="font-pixel text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">✕</button>
        </div>

        {!social ? (
          <div className="text-center space-y-3 py-4">
            <p className="font-game text-sm text-muted-foreground">Para ter um nick e adicionar amigos, crie uma conta (é grátis).</p>
            {onCreateAccount && (
              <button onClick={onCreateAccount} className="font-pixel text-xs px-4 py-3 bg-primary text-primary-foreground rounded-lg">
                Entrar / criar conta
              </button>
            )}
          </div>
        ) : social.available === false ? (
          <div className="space-y-3 py-2">
            <p className="font-game text-sm">Seu nick: <b className="text-primary">@{social.nick}</b></p>
            <p className="font-game text-sm text-muted-foreground">
              🛠️ O sistema de amigos está sendo ativado no servidor. Volte daqui a pouco!
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Meu nick */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
              <div className="min-w-0">
                <p className="font-game text-[11px] text-muted-foreground">Seu nick (seus amigos usam para te achar)</p>
                <p className="font-pixel text-sm text-primary truncate">@{social.nick}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={copyNick} title="Copiar nick" className="px-2 py-1.5 rounded bg-muted hover:bg-muted/80 text-sm">📋</button>
                {onChangeNick && <button onClick={onChangeNick} title="Trocar nick" className="px-2 py-1.5 rounded bg-muted hover:bg-muted/80 text-sm">✏️</button>}
              </div>
            </div>

            {/* Adicionar */}
            <div>
              <p className="font-game text-xs text-muted-foreground mb-1.5">Adicionar amigo pelo nick:</p>
              <form onSubmit={e => { e.preventDefault(); add(); }} className="flex gap-2">
                <input
                  aria-label="Nick do amigo"
                  value={addNick}
                  onChange={e => { setAddNick(e.target.value.replace(/\s/g, '')); setMsg(null); }}
                  maxLength={17}
                  placeholder="@nick do amigo"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-muted border border-border font-game text-sm focus:outline-none focus:border-primary"
                />
                <button type="submit" disabled={!addNick || busy} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-game text-sm disabled:opacity-50">
                  ➕ Adicionar
                </button>
              </form>
              {msg && <p className={`mt-2 font-game text-xs ${msg.ok ? 'text-green-400' : 'text-red-300'}`}>{msg.text}</p>}
            </div>

            {/* Pedidos recebidos */}
            {social.incoming.length > 0 && (
              <div>
                <p className="font-game text-xs text-amber-300 mb-1.5">📨 Pedidos de amizade ({social.incoming.length})</p>
                <div className="space-y-1.5">
                  {social.incoming.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-900/20 border border-amber-500/30 px-3 py-2">
                      <span className="font-game text-sm truncate">@{r.nick}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => social.accept(r.id)} className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-game text-xs">✔ Aceitar</button>
                        <button onClick={() => social.remove(r.id)} className="px-3 py-1.5 rounded bg-muted font-game text-xs">✕ Recusar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amigos */}
            <div>
              <p className="font-game text-xs text-muted-foreground mb-1.5">
                Seus amigos ({social.friends.length}) · 🟢 {social.friends.filter(f => f.online).length} online
              </p>
              {social.friends.length === 0 ? (
                <div className="text-center py-5 bg-muted/30 rounded-lg border border-border/30">
                  <p className="font-game text-sm text-muted-foreground">Você ainda não tem amigos aqui</p>
                  <p className="font-game text-xs text-muted-foreground/70 mt-1">Peça o nick de um amigo e adicione acima!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {social.friends.map(f => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 border border-border/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-game text-sm truncate">
                          <span className={f.online ? 'text-green-400' : 'text-muted-foreground/50'}>●</span> @{f.nick}
                        </p>
                        <p className="font-game text-[11px] text-muted-foreground">
                          {f.room ? `🎮 Jogando na sala ${f.room}` : f.online ? 'Online no menu' : 'Offline'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {f.room && (
                          <button onClick={() => join(f)} disabled={busy} className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-game text-xs disabled:opacity-50">
                            ▶ Entrar
                          </button>
                        )}
                        {confirmRemove === f.id ? (
                          <button onClick={() => { social.remove(f.id); setConfirmRemove(null); }} className="px-2 py-1.5 rounded bg-red-900/60 font-game text-xs">Remover?</button>
                        ) : (
                          <button onClick={() => setConfirmRemove(f.id)} title="Remover amigo" className="px-2 py-1.5 rounded bg-muted font-game text-xs">🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pedidos enviados */}
            {social.outgoing.length > 0 && (
              <div>
                <p className="font-game text-xs text-muted-foreground mb-1.5">⏳ Esperando aceitar</p>
                <div className="space-y-1">
                  {social.outgoing.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-muted/30">
                      <span className="font-game text-xs text-muted-foreground truncate">@{r.nick}</span>
                      <button onClick={() => social.remove(r.id)} className="font-game text-[11px] text-muted-foreground underline">cancelar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
