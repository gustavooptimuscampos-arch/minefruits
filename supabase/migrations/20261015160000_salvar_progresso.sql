-- Progresso salvo de cada jogador (mundo solo, inventário, moedas), para continuar em qualquer aparelho
CREATE TABLE IF NOT EXISTS public.player_saves (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Proteção contra salvamentos gigantes (~2 MB)
  CONSTRAINT player_saves_tamanho CHECK (pg_column_size(data) < 2000000)
);

ALTER TABLE public.player_saves ENABLE ROW LEVEL SECURITY;

-- Cada um só vê e mexe no próprio progresso
CREATE POLICY "Ler o próprio progresso" ON public.player_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Criar o próprio progresso" ON public.player_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Atualizar o próprio progresso" ON public.player_saves
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
