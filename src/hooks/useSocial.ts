import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { validateNick } from '@/lib/nameFilter';

export interface FriendshipRow {
  id: string;
  requester: string;
  addressee: string;
  status: string;
  created_at: string;
}

export interface Friend {
  /** id da amizade (para aceitar/remover) */
  id: string;
  userId: string;
  nick: string;
  online: boolean;
  /** código da sala em que o amigo está jogando agora (se estiver numa) */
  room: string | null;
}

/** Resultado de uma ação (o projeto não usa strict, então sem união discriminada). */
type ActionResult = { ok: boolean; message?: string; error?: string };

/** Tabela ainda não criada no servidor (migration não aplicada). */
function missingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === 'PGRST205' || err.code === '42P01' || /does not exist|schema cache/i.test(err.message ?? ''));
}

/** ilike sem curinga: "_" no nick é letra, não "qualquer caractere". */
const exactIlike = (nick: string) => nick.trim().replace(/[\\%_]/g, c => '\\' + c);

const ONLINE_CHANNEL = 'minefruits-online';

/**
 * Nick e amigos do jogador logado.
 * - nick único (tabela player_nicks), também guardado nos metadados da conta
 * - pedidos de amizade em tempo real (tabela friendships)
 * - quem está online e em qual sala (presença do Realtime, sem tabela)
 */
export function useSocial(userId: string | null, metadataNick: string | null, currentRoom: string | null) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [nick, setNickState] = useState<string | null>(metadataNick);
  const [nickLoaded, setNickLoaded] = useState(false);
  const [rows, setRows] = useState<FriendshipRow[]>([]);
  const [nicks, setNicks] = useState<Record<string, string>>({});
  const [online, setOnline] = useState<Record<string, string | null>>({});
  const roomRef = useRef(currentRoom);
  roomRef.current = currentRoom;
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ---- Nick ----
  useEffect(() => {
    if (!userId) { setNickLoaded(true); return; }
    let cancelled = false;
    setNickLoaded(false);
    supabase.from('player_nicks').select('nick').eq('user_id', userId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (missingTable(error)) {
        setAvailable(false);
      } else if (!error) {
        setAvailable(true);
        if (data?.nick) setNickState(data.nick);
        else if (metadataNick) {
          // Nick só nos metadados (criado antes de o servidor ter a tabela): registra agora
          supabase.from('player_nicks').insert({ user_id: userId, nick: metadataNick }).then(({ error: e }) => {
            if (e && !cancelled) setNickState(null); // já é de outra pessoa: escolhe outro
          });
        }
      } else {
        setAvailable(true); // erro de rede: tenta usar mesmo assim
      }
      setNickLoaded(true);
    });
    return () => { cancelled = true; };
    // metadataNick só importa na primeira carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isNickFree = useCallback(async (candidate: string): Promise<boolean | null> => {
    if (!available) return null;
    const { data, error } = await supabase.from('player_nicks').select('user_id').ilike('nick', exactIlike(candidate)).limit(1);
    if (error) return null;
    return !data?.length || data[0].user_id === userId;
  }, [available, userId]);

  const saveNick = useCallback(async (candidate: string): Promise<ActionResult> => {
    const n = candidate.trim();
    const invalid = validateNick(n);
    if (invalid) return { ok: false, error: invalid };
    if (!userId) return { ok: false, error: 'Entre na sua conta para ter um nick' };
    if (available !== false) {
      const { error } = await supabase.from('player_nicks')
        .upsert({ user_id: userId, nick: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error && !missingTable(error)) {
        if (error.code === '23505') return { ok: false, error: '😕 Esse nick já é de outro jogador. Tente outro!' };
        if (error.code === '23514') return { ok: false, error: 'Use só letras, números e _ (3 a 16)' };
        return { ok: false, error: 'Sem conexão com o servidor. Tente de novo.' };
      }
      if (missingTable(error)) setAvailable(false);
    }
    await supabase.auth.updateUser({ data: { nick: n } });
    setNickState(n);
    return { ok: true };
  }, [userId, available]);

  // ---- Amizades ----
  const loadFriends = useCallback(async () => {
    if (!userId || !available) return;
    const { data, error } = await supabase.from('friendships').select('*');
    if (error) { if (missingTable(error)) setAvailable(false); return; }
    const list = (data ?? []) as FriendshipRow[];
    setRows(list);
    const others = [...new Set(list.map(r => (r.requester === userId ? r.addressee : r.requester)))];
    if (others.length) {
      const { data: found } = await supabase.from('player_nicks').select('user_id, nick').in('user_id', others);
      setNicks(Object.fromEntries((found ?? []).map(f => [f.user_id, f.nick])));
    } else {
      setNicks({});
    }
  }, [userId, available]);

  useEffect(() => {
    if (!userId || !available) return;
    loadFriends();
    // Pedido novo, aceito ou removido: atualiza na hora
    const channel = supabase
      .channel(`amizades-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => { loadFriends(); })
      .subscribe();
    // Garantia caso o Realtime caia
    const poll = setInterval(loadFriends, 30000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [userId, available, loadFriends]);

  // ---- Online (presença) ----
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(ONLINE_CHANNEL, { config: { presence: { key: userId } } });
    presenceRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ room: string | null }>();
        const next: Record<string, string | null> = {};
        for (const [key, presences] of Object.entries(state)) {
          next[key] = presences.find(p => p.room)?.room ?? null;
        }
        setOnline(next);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') channel.track({ room: roomRef.current });
      });
    return () => { presenceRef.current = null; supabase.removeChannel(channel); };
  }, [userId]);

  // Avisa aos amigos quando entra/sai de uma sala
  useEffect(() => {
    presenceRef.current?.track({ room: currentRoom }).catch(() => {});
  }, [currentRoom]);

  const friends = useMemo<Friend[]>(() => {
    if (!userId) return [];
    return rows
      .filter(r => r.status === 'accepted')
      .map(r => {
        const other = r.requester === userId ? r.addressee : r.requester;
        return { id: r.id, userId: other, nick: nicks[other] ?? '???', online: other in online, room: online[other] ?? null };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.nick.localeCompare(b.nick));
  }, [rows, nicks, online, userId]);

  const incoming = useMemo(() => rows
    .filter(r => r.status === 'pending' && r.addressee === userId)
    .map(r => ({ id: r.id, userId: r.requester, nick: nicks[r.requester] ?? '???' })), [rows, nicks, userId]);
  const outgoing = useMemo(() => rows
    .filter(r => r.status === 'pending' && r.requester === userId)
    .map(r => ({ id: r.id, userId: r.addressee, nick: nicks[r.addressee] ?? '???' })), [rows, nicks, userId]);

  const sendRequest = useCallback(async (targetNick: string): Promise<ActionResult> => {
    if (!userId) return { ok: false, error: 'Entre na sua conta para adicionar amigos' };
    const n = targetNick.trim().replace(/^@/, '');
    if (!n) return { ok: false, error: 'Digite o nick do amigo' };
    const { data, error } = await supabase.from('player_nicks').select('user_id, nick').ilike('nick', exactIlike(n)).limit(1);
    if (error) return { ok: false, error: 'Sem conexão com o servidor. Tente de novo.' };
    const target = data?.[0];
    if (!target) return { ok: false, error: `Nenhum jogador com o nick "${n}"` };
    if (target.user_id === userId) return { ok: false, error: 'Esse nick é o seu! 😄' };
    const existing = rows.find(r => r.requester === target.user_id || r.addressee === target.user_id);
    if (existing?.status === 'accepted') return { ok: false, error: `Você e ${target.nick} já são amigos` };
    if (existing && existing.requester === userId) return { ok: false, error: `Pedido para ${target.nick} já enviado. Espere ele aceitar` };
    if (existing) {
      // Ele já tinha mandado pedido para você: aceita
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', existing.id);
      await loadFriends();
      return { ok: true, message: `🎉 Agora você e ${target.nick} são amigos!` };
    }
    const { error: insErr } = await supabase.from('friendships').insert({ requester: userId, addressee: target.user_id });
    if (insErr) {
      if (insErr.code === '23505') return { ok: false, error: 'Já existe um pedido entre vocês' };
      if (/limite_pedidos/.test(insErr.message)) return { ok: false, error: 'Você tem muitos pedidos esperando resposta' };
      if (/limite_amigos/.test(insErr.message)) return { ok: false, error: 'Você chegou ao limite de amigos' };
      return { ok: false, error: 'Não deu para enviar o pedido. Tente de novo.' };
    }
    await loadFriends();
    return { ok: true, message: `✉️ Pedido enviado para ${target.nick}` };
  }, [userId, rows, loadFriends]);

  const accept = useCallback(async (id: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    await loadFriends();
  }, [loadFriends]);

  const remove = useCallback(async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id);
    await loadFriends();
  }, [loadFriends]);

  return {
    /** null = ainda verificando; false = servidor sem as tabelas de amigos */
    available,
    nick,
    nickLoaded,
    isNickFree,
    saveNick,
    friends,
    incoming,
    outgoing,
    sendRequest,
    accept,
    remove,
  };
}

export type Social = ReturnType<typeof useSocial>;
