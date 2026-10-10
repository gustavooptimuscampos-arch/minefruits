import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import gameBg from '@/assets/game-bg.jpg';

const COUNTRIES = [
  'Brasil', 'Portugal', 'Estados Unidos', 'Argentina', 'México',
  'Colômbia', 'Chile', 'Peru', 'Uruguai', 'Paraguai',
  'Angola', 'Moçambique', 'Espanha', 'França', 'Alemanha',
  'Japão', 'Coreia do Sul', 'Outro',
];

const BLOCKED_WORDS = [
  'porra', 'caralho', 'puta', 'merda', 'fdp', 'viado', 'buceta',
  'cu', 'foda', 'cuzao', 'arrombado', 'desgraça', 'vagabundo',
  'idiota', 'imbecil', 'otario', 'babaca', 'bosta', 'piranha',
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'bastard', 'damn',
  'admin', 'moderador', 'mod', 'staff', 'suporte', 'system',
];

const SUSPICIOUS_PATTERNS = [
  /^[^a-zA-ZÀ-ú]+$/, // only numbers/symbols
  /(.)\1{3,}/, // repeated chars (aaaa, 1111)
  /^.{1,2}$/, // too short (1-2 chars)
  /[<>{}[\]\\/]/, // code injection chars
  /^\d+$/, // only digits
];

const MIN_AGE = 9;

function validateName(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  
  if (trimmed.length < 3) return 'Nome deve ter pelo menos 3 caracteres';
  if (trimmed.length > 20) return 'Nome deve ter no máximo 20 caracteres';

  // Compara palavras inteiras: com includes(), nomes como "Marcus" (cu) e "Cassio" (ass) eram bloqueados
  const words = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  const joined = words.join('');
  for (const word of BLOCKED_WORDS) {
    const plain = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hit = plain.length <= 4 ? words.includes(plain) : words.includes(plain) || joined.includes(plain);
    if (hit) {
      return '⚠️ Nome contém palavras ofensivas ou proibidas';
    }
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return '⚠️ Nome suspeito detectado. Use um nome real';
    }
  }

  return null;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const handleNameChange = (value: string) => {
    setDisplayName(value);
    const nameError = validateName(value);
    setWarning(nameError || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Validate name
        const nameError = validateName(displayName);
        if (nameError) { setError(nameError); setLoading(false); return; }

        // Validate age
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) { setError('Idade inválida'); setLoading(false); return; }
        if (ageNum < MIN_AGE) { 
          setError(`⚠️ Você precisa ter pelo menos ${MIN_AGE} anos para jogar Mine Fruits`); 
          setLoading(false); 
          return; 
        }

        if (!country) { setError('Selecione seu país'); setLoading(false); return; }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // idade e país também vão nos metadados: sem login ativo (confirmação de e-mail)
          // o update em "profiles" abaixo é bloqueado pelo RLS e os dados se perdiam
          options: { data: { display_name: displayName.trim(), age: ageNum, country } },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          // Supabase exige confirmação de e-mail: antes a tela ficava parada sem explicação
          setInfo('📧 Conta criada! Abra o link que enviamos para o seu e-mail e depois faça login.');
          setIsLogin(true);
          return;
        }

        if (data.user) {
          await supabase.from('profiles').update({
            age: ageNum,
            country,
            display_name: displayName.trim(),
          }).eq('id', data.user.id);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(
        /Invalid login credentials/i.test(message) ? 'E-mail ou senha incorretos.'
        : /Email not confirmed/i.test(message) ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'
        : /already registered/i.test(message) ? 'Este e-mail já tem conta. Faça login.'
        : message || 'Erro ao autenticar',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${gameBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/40" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8 short:mb-3 short:pt-14">
          <h1 className="font-pixel text-3xl text-primary text-glow-green">MINE</h1>
          <h1 className="font-pixel text-3xl text-secondary text-glow-orange">FRUITS</h1>
        </div>

        <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-6">
          <h2 className="font-pixel text-lg text-center text-foreground mb-6">
            {isLogin ? '🔑 LOGIN' : '📝 CRIAR CONTA'}
          </h2>

          {!isLogin && (
            <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <p className="text-[10px] font-pixel text-destructive text-center leading-relaxed">
                ⚠️ PROIBIDO IDENTIDADES FALSAS — Pena de multa de R$ 3.000
              </p>
              <p className="text-[9px] font-game text-destructive/70 text-center mt-1">
                Use seu nome real. Contas com informações falsas serão banidas.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-xs font-game text-muted-foreground block mb-1">Nome do Jogador</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => handleNameChange(e.target.value)}
                    className={`w-full px-3 py-2 bg-muted/50 border rounded-lg text-sm font-game text-foreground focus:outline-none focus:border-primary ${warning ? 'border-destructive' : 'border-border'}`}
                    placeholder="Seu nome real"
                    maxLength={20}
                    required
                  />
                  {warning && (
                    <p className="text-[10px] font-game text-destructive mt-1">{warning}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-game text-muted-foreground block mb-1">Idade</label>
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-game text-foreground focus:outline-none focus:border-primary"
                      placeholder="Idade"
                      min={1}
                      max={120}
                      required
                    />
                    {age && parseInt(age) < MIN_AGE && parseInt(age) > 0 && (
                      <p className="text-[10px] font-game text-destructive mt-1">Mínimo {MIN_AGE} anos</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-game text-muted-foreground block mb-1">País</label>
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-game text-foreground focus:outline-none focus:border-primary"
                      required
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-game text-muted-foreground block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-game text-foreground focus:outline-none focus:border-primary"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="text-xs font-game text-muted-foreground block mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm font-game text-foreground focus:outline-none focus:border-primary"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {info && (
              <div className="text-xs font-game text-foreground bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
                {info}
              </div>
            )}

            {error && (
              <div className="text-xs font-game text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!!warning && !isLogin)}
              className="w-full font-pixel text-sm px-6 py-3 bg-primary text-primary-foreground rounded-lg box-glow-green hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? '...' : isLogin ? '▶ ENTRAR' : '✅ CRIAR CONTA'}
            </button>
          </form>

          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); setWarning(''); setInfo(''); }}
            className="w-full mt-4 text-xs font-game text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Fazer login'}
          </button>
        </div>
      </div>
    </div>
  );
}
