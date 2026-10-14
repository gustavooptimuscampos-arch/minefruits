-- Nick único de cada jogador (o nome que os outros veem; o nome real fica só no perfil)
CREATE TABLE IF NOT EXISTS public.player_nicks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nick text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT player_nicks_formato CHECK (nick ~ '^[A-Za-z0-9_]{3,16}$')
);

-- "Gustavo" e "gustavo" são o mesmo nick
CREATE UNIQUE INDEX IF NOT EXISTS player_nicks_nick_unico ON public.player_nicks (lower(nick));

ALTER TABLE public.player_nicks ENABLE ROW LEVEL SECURITY;

-- Quem tem conta pode procurar um nick (só nick e id; idade, país e nome real ficam escondidos)
CREATE POLICY "Contas leem nicks" ON public.player_nicks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cada um cria o seu nick" ON public.player_nicks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cada um troca o seu nick" ON public.player_nicks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Amizades: pedido pendente até o outro aceitar
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT friendships_status CHECK (status IN ('pending', 'accepted')),
  CONSTRAINT friendships_nao_eu CHECK (requester <> addressee)
);

-- Um só registro por dupla, não importa quem pediu
CREATE UNIQUE INDEX IF NOT EXISTS friendships_dupla_unica
  ON public.friendships (LEAST(requester, addressee), GREATEST(requester, addressee));

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver as próprias amizades" ON public.friendships
  FOR SELECT TO authenticated USING (auth.uid() = requester OR auth.uid() = addressee);
CREATE POLICY "Enviar pedido de amizade" ON public.friendships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester AND status = 'pending');
CREATE POLICY "Aceitar pedido recebido" ON public.friendships
  FOR UPDATE TO authenticated USING (auth.uid() = addressee) WITH CHECK (auth.uid() = addressee AND status = 'accepted');
CREATE POLICY "Recusar, cancelar ou desfazer amizade" ON public.friendships
  FOR DELETE TO authenticated USING (auth.uid() = requester OR auth.uid() = addressee);

-- Contra spam: no máximo 20 pedidos esperando resposta e 200 amigos
CREATE OR REPLACE FUNCTION public.limitar_pedidos_amizade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.friendships WHERE requester = NEW.requester AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'limite_pedidos';
  END IF;
  IF (SELECT count(*) FROM public.friendships
      WHERE (requester = NEW.requester OR addressee = NEW.requester) AND status = 'accepted') >= 200 THEN
    RAISE EXCEPTION 'limite_amigos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendships_limite ON public.friendships;
CREATE TRIGGER friendships_limite
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.limitar_pedidos_amizade();

-- Pedidos chegam na hora (sem recarregar a página)
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
