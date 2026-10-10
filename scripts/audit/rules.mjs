// Regras estáticas específicas do Mine Fruits.
// Cada regra recebe o contexto e devolve achados { rule, severity, category, file, line, message, fix }.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listFiles, read, rel, lineOf, matchBrace, findEffects } from './utils.mjs';

const GAME_DIR = 'src/components/game';

function finding(rule, severity, category, file, line, message, fix) {
  return { rule, severity, category, file, line, message, fix };
}

function sources() {
  return listFiles('src', ['.ts', '.tsx']).filter((f) => !rel(f).startsWith('src/components/ui/'));
}

// ───────────────────────── Navegação ─────────────────────────

/** NAV-001/002: toda tela declarada em Index.tsx é renderizada e tem caminho de volta. */
function screensFlow() {
  const file = 'src/pages/Index.tsx';
  if (!fs.existsSync(path.join(ROOT, file))) return [];
  const text = read(file);
  const out = [];
  const typeMatch = /type\s+Screen\s*=\s*([^;]+);/.exec(text);
  if (!typeMatch) return out;
  const screens = [...typeMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const initial = /useState<Screen>\('([^']+)'\)/.exec(text)?.[1];

  for (const s of screens) {
    if (s === initial) continue;
    const branch = new RegExp(`screen\\s*===\\s*'${s}'`).exec(text);
    if (!branch) {
      out.push(finding('NAV-001', 'erro', 'Navegação', file, lineOf(text, typeMatch.index),
        `A tela '${s}' existe no tipo Screen mas nunca é renderizada: o jogador fica numa tela em branco.`,
        `Adicione um bloco if (screen === '${s}') return <... />;`));
      continue;
    }
    const block = text.slice(branch.index, branch.index + 600);
    if (!/on(Back|Exit|Close)\s*=/.test(block)) {
      out.push(finding('NAV-002', 'erro', 'Navegação', file, lineOf(text, branch.index),
        `A tela '${s}' não recebe onBack/onExit: o jogador não tem como voltar.`,
        'Passe um callback que volte para a tela anterior.'));
    }
  }
  for (const m of text.matchAll(/setScreen\('([^']+)'\)/g)) {
    if (!screens.includes(m[1])) {
      out.push(finding('NAV-001', 'erro', 'Navegação', file, lineOf(text, m.index),
        `setScreen('${m[1]}') aponta para uma tela que não existe.`, 'Corrija o nome da tela.'));
    }
  }
  return out;
}

/** NAV-003/004: rotas, catch-all por último, links internos válidos. */
function routes() {
  const file = 'src/App.tsx';
  if (!fs.existsSync(path.join(ROOT, file))) return [];
  const text = read(file);
  const out = [];
  const paths = [...text.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => ({ p: m[1], i: m.index }));
  const star = paths.findIndex((r) => r.p === '*');
  if (star >= 0 && star !== paths.length - 1) {
    out.push(finding('NAV-003', 'erro', 'Navegação', file, lineOf(text, paths[star + 1].i),
      'Há rotas depois do catch-all "*": elas nunca serão alcançadas (página 404 no lugar).',
      'Mova a rota "*" para o final.'));
  }
  const known = new Set(paths.map((r) => r.p));
  for (const f of sources()) {
    const t = read(f);
    for (const m of t.matchAll(/(?:navigate\(|<Link[^>]*\bto=|<a[^>]*\bhref=)["'`](\/[^"'`]*)["'`]/g)) {
      const target = m[1].split(/[?#]/)[0] || '/';
      if (!known.has(target) && !known.has('*')) {
        out.push(finding('NAV-003', 'erro', 'Navegação', rel(f), lineOf(t, m.index),
          `Link para "${target}", que não é uma rota.`, 'Crie a rota ou corrija o link.'));
      }
    }
    for (const m of t.matchAll(/<a\s[^>]*href=["']\/[^"']*["']/g)) {
      out.push(finding('NAV-004', 'aviso', 'Navegação', rel(f), lineOf(t, m.index),
        'Link interno com <a href>: recarrega a página inteira e perde o estado do jogo.',
        'Use <Link to="..."> do react-router-dom.'));
    }
  }
  return out;
}

// ───────────────────────── Contexto (estado, eventos) ─────────────────────────

/** CTX-001: atalhos de teclado globais precisam ignorar quando o jogador está digitando. */
function keyboardGuards() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx', '.ts'])) {
    const t = read(f);
    for (const eff of findEffects(t)) {
      if (!/addEventListener\(\s*'key(down|up)'/.test(eff.body)) continue;
      if (/isTypingTarget\(|tagName|isContentEditable/.test(eff.body)) continue;
      out.push(finding('CTX-001', 'aviso', 'Quebra de contexto', rel(f), lineOf(t, eff.index),
        'Atalho de teclado global não confere se o jogador está digitando: hoje só o stopPropagation do chat segura; qualquer campo de texto novo (nome, busca) vai abrir craft/loja e andar enquanto o jogador digita.',
        'No início do handler: if (isTypingTarget(e.target)) return;'));
    }
  }
  return out;
}

/** CTX-002/003: listeners, timers e canais precisam ser limpos ao desmontar. */
function cleanups() {
  const out = [];
  for (const f of sources()) {
    const t = read(f);
    for (const eff of findEffects(t)) {
      const adds = (eff.body.match(/addEventListener\(/g) || []).length;
      const removes = (eff.body.match(/removeEventListener\(/g) || []).length;
      if (adds > removes) {
        out.push(finding('CTX-002', 'erro', 'Quebra de contexto', rel(f), lineOf(t, eff.index),
          `useEffect adiciona ${adds} listener(s) e remove ${removes}: eventos continuam disparando depois de sair da tela.`,
          'Retorne uma função de limpeza com removeEventListener.'));
      }
      if (/setInterval\(/.test(eff.body) && !/clearInterval\(/.test(eff.body)) {
        out.push(finding('CTX-002', 'erro', 'Quebra de contexto', rel(f), lineOf(t, eff.index),
          'setInterval sem clearInterval no useEffect: o timer sobrevive à tela.', 'Retorne () => clearInterval(id).'));
      }
      if (/\.channel\(/.test(eff.body) && !/unsubscribe\(|removeChannel\(/.test(eff.body)) {
        out.push(finding('CTX-003', 'erro', 'Quebra de contexto', rel(f), lineOf(t, eff.index),
          'Canal realtime aberto sem unsubscribe: a sala continua conectada depois de sair.', 'Chame channel.unsubscribe() na limpeza.'));
      }
    }
  }
  return out;
}

/** CTX-004: efeitos colaterais (outro setState, timer, callback) dentro de um updater de setState. */
function sideEffectsInUpdaters() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx', '.ts']).concat(listFiles('src/pages', ['.tsx']))) {
    const t = read(f);
    const re = /\b(set[A-Z]\w*)\(\s*\(?\s*\w+\s*\)?\s*=>/g;
    let m;
    while ((m = re.exec(t))) {
      const open = m.index + m[1].length;
      const end = matchBrace(t, open);
      if (end < 0) continue;
      const body = t.slice(m.index + m[0].length, end);
      const inner = /\b(set[A-Z]\w*)\(|\bsetTimeout\(|\bon[A-Z]\w*\(/.exec(body);
      if (inner) {
        out.push(finding('CTX-004', 'erro', 'Quebra de contexto', rel(f), lineOf(t, m.index + m[0].length + inner.index),
          `Efeito colateral (${inner[0].replace('(', '')}) dentro do updater de ${m[1]}: o React pode rodar o updater mais de uma vez e duplicar pontos, moedas ou timers.`,
          'Calcule o resultado fora do updater (com uma ref do estado atual) e chame os outros setState em seguida.'));
      }
      re.lastIndex = end;
    }
  }
  return out;
}

/** CTX-005: efeito que reposiciona o jogador/câmera dependendo do mapa → teleporta a cada bloco quebrado. */
function respawnOnWorldChange() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx'])) {
    const t = read(f);
    for (const eff of findEffects(t)) {
      if (!/position\.set\(/.test(eff.body) || !eff.deps) continue;
      if (eff.deps.includes('blocks') && !/spawnedRef|respawnKey|hasSpawned/.test(eff.body)) {
        out.push(finding('CTX-005', 'erro', 'Fluxo do jogo', rel(f), lineOf(t, eff.index),
          'Efeito de spawn depende de "blocks": cada bloco quebrado manda o jogador de volta ao ponto inicial.',
          'Rode o spawn só na montagem (e ao renascer), não a cada mudança do mapa.'));
      }
    }
  }
  return out;
}

// ───────────────────────── Fluxo de jogo / UX ─────────────────────────

/** FLOW-001: PointerLockControls sem selector captura o mouse em qualquer clique (inclusive nos menus). */
function pointerLock() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx'])) {
    const t = read(f);
    for (const m of t.matchAll(/<PointerLockControls\b[^>]*>/g)) {
      if (!/\bselector=/.test(m[0])) {
        out.push(finding('FLOW-001', 'erro', 'Fluxo de navegação', rel(f), lineOf(t, m.index),
          'PointerLockControls sem "selector": clicar em botões de menus (Craftar, Comprar) prende o mouse e some com o cursor.',
          'Use selector apontando só para o canvas do jogo e enabled={false} enquanto um menu estiver aberto.'));
      }
    }
  }
  return out;
}

/** FLOW-002: Esc sai direto do jogo, perdendo todo o progresso, sem confirmação. */
function escapeExits() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx'])) {
    const t = read(f);
    const re = /'Escape'[^\n]*\n?[^\n]*onExit\(\)/g;
    for (const m of t.matchAll(re)) {
      out.push(finding('FLOW-002', 'erro', 'Fluxo de navegação', rel(f), lineOf(t, m.index),
        'Esc chama onExit() direto: um toque sem querer encerra a partida e apaga o progresso.',
        'Mostre um menu de pausa com "Continuar" e "Sair".'));
    }
  }
  return out;
}

/** FLOW-003: teclas anunciadas na interface precisam ter handler. */
function advertisedKeys() {
  const out = [];
  const files = listFiles(GAME_DIR, ['.tsx']);
  const all = files.map((f) => read(f)).join('\n');
  for (const f of files) {
    const t = read(f);
    for (const m of t.matchAll(/(?:>|•|'|\s)([A-Z])\s+(craftar|loja|ranking|câmera|para chat|Fechar|Sair)\b/g)) {
      const code = `'Key${m[1]}'`;
      if (!all.includes(code)) {
        out.push(finding('FLOW-003', 'erro', 'UX', rel(f), lineOf(t, m.index),
          `A interface diz "${m[1]} ${m[2]}" mas nenhuma tecla ${m[1]} está programada.`, `Adicione o handler para ${code}.`));
      }
    }
  }
  return out;
}

/** NET-001: posição enviada pela rede a cada frame (60x/s) estoura o limite do Supabase Realtime. */
function realtimeThrottle() {
  const out = [];
  const file = `${GAME_DIR}/useMultiplayer.ts`;
  if (!fs.existsSync(path.join(ROOT, file))) return out;
  const t = read(file);
  const m = /const\s+sendPosition\s*=\s*useCallback\(/.exec(t);
  if (!m) return out;
  const start = t.indexOf('{', m.index);
  const body = t.slice(start, matchBrace(t, start) + 1);
  if (!/Date\.now\(\)|performance\.now\(\)|throttle|lastSent/i.test(body)) {
    out.push(finding('NET-001', 'erro', 'Multiplayer', file, lineOf(t, m.index),
      'sendPosition é chamado a cada frame sem limite: ~60 mensagens/s por jogador. O Supabase Realtime limita a taxa e a sala trava ou desconecta.',
      'Limite o envio a ~10 por segundo (guarde o horário do último envio).'));
  }
  return out;
}

/** PERF-001: luzes dinâmicas dentro de listas (mudar a quantidade recompila todos os shaders → travada). */
function dynamicLights() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx'])) {
    const t = read(f);
    if (!/\.map\(/.test(t)) continue;
    for (const m of t.matchAll(/<pointLight\b/g)) {
      out.push(finding('PERF-001', 'aviso', 'Desempenho', rel(f), lineOf(t, m.index),
        'pointLight em item de lista (mob, fruta, moeda): toda vez que um aparece ou some o número de luzes muda, o three.js recompila todos os materiais e o jogo dá uma travada.',
        'Use material emissivo (brilho próprio) em vez de uma luz por item.'));
    }
  }
  return out;
}

/** UX-001: @import de fonte depois de outras regras é ignorado pelo navegador. */
function cssImports() {
  const out = [];
  for (const f of listFiles('src', ['.css'])) {
    const t = read(f);
    const lines = t.split('\n');
    let seenRule = false;
    lines.forEach((line, i) => {
      const s = line.trim();
      if (!s || s.startsWith('/*') || s.startsWith('*') || s.startsWith('@charset')) return;
      if (s.startsWith('@import')) {
        if (seenRule) {
          out.push(finding('UX-001', 'erro', 'UX', rel(f), i + 1,
            '@import depois de outras regras: no build de produção a fonte do jogo (Press Start 2P) não carrega.',
            'Mova o @import para a primeira linha do arquivo.'));
        }
      } else seenRule = true;
    });
  }
  return out;
}

/** UX-002: textos em inglês numa interface em português. */
function englishStrings() {
  const out = [];
  const phrases = ['Page not found', 'Return to Home', 'Loading...', 'Something went wrong', 'Submit', 'Oops!'];
  for (const f of sources()) {
    const t = read(f);
    for (const p of phrases) {
      const hit = new RegExp(`[>"'\`]\\s*${p.replace(/[.!?]/g, '\\$&')}`).exec(t);
      const i = hit ? hit.index : -1;
      if (i >= 0) {
        out.push(finding('UX-002', 'aviso', 'UX', rel(f), lineOf(t, i),
          `Texto em inglês na interface: "${p}".`, 'Traduza para português.'));
      }
    }
  }
  return out;
}

/** UX-003: jogo exige teclado + mouse; avisar quem abre no celular. */
function touchSupport() {
  const all = sources().map((f) => read(f)).join('\n');
  if (/pointer:\s*coarse|ontouchstart|maxTouchPoints/.test(all)) return [];
  return [finding('UX-003', 'aviso', 'UX', 'src/components/game/StartScreen.tsx', 1,
    'O jogo só funciona com teclado e mouse, mas nada avisa quem abre no celular/tablet: a tela fica parada.',
    'Detecte toque (matchMedia("(pointer: coarse)")) e mostre um aviso.')];
}

/** UX-004: totais fixos no HUD (ex.: "/10") desatualizam quando o mapa muda. */
function hardcodedTotals() {
  const out = [];
  for (const f of listFiles(GAME_DIR, ['.tsx'])) {
    const t = read(f);
    for (const m of t.matchAll(/\}\/(\d+)</g)) {
      out.push(finding('UX-004', 'aviso', 'UX', rel(f), lineOf(t, m.index),
        `Total fixo "/${m[1]}" no HUD: se a quantidade de itens do mapa mudar, o contador fica errado.`,
        'Passe o total real como prop.'));
    }
  }
  return out;
}

// ───────────────────────── Cadastro / produto ─────────────────────────

function authRules() {
  const file = 'src/pages/Auth.tsx';
  if (!fs.existsSync(path.join(ROOT, file))) return [];
  const t = read(file);
  const out = [];
  const age = /MIN_AGE\s*=\s*(\d+)/.exec(t);
  if (age && Number(age[1]) > 18) {
    out.push(finding('PROD-001', 'aviso', 'Produto (decisão do dono)', file, lineOf(t, age.index),
      `Idade mínima de ${age[1]} anos para criar conta: quase nenhum jogador consegue se cadastrar.`,
      'Confirme com o dono do jogo o valor desejado.'));
  }
  const words = /BLOCKED_WORDS\s*=\s*\[([\s\S]*?)\]/.exec(t);
  if (words && /\.includes\(word\)/.test(t)) {
    const short = [...words[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((w) => w.length <= 3);
    if (short.length) {
      out.push(finding('DATA-001', 'erro', 'Fluxo de cadastro', file, lineOf(t, words.index),
        `Filtro de palavrões por substring com palavras curtas (${short.join(', ')}): nomes normais como "Marcus" e "Cassio" são bloqueados.`,
        'Compare palavras inteiras (\\b...\\b) em vez de includes().'));
    }
  }
  if (/auth\.signUp\(/.test(t) && !/data\.session|!data\?\.session|session\s*===\s*null/.test(t)) {
    out.push(finding('DATA-002', 'erro', 'Fluxo de cadastro', file, lineOf(t, t.indexOf('auth.signUp(')),
      'Depois do cadastro, se o Supabase exigir confirmação de e-mail, nada acontece na tela: o jogador acha que travou.',
      'Se data.session vier vazio, mostre "Confira seu e-mail para ativar a conta".'));
  }
  return out;
}

/** SEC-001: políticas RLS que deixam qualquer um apagar/editar salas. */
function rlsPolicies() {
  const out = [];
  for (const f of listFiles('supabase/migrations', ['.sql'])) {
    const t = read(f);
    for (const m of t.matchAll(/FOR\s+(UPDATE|DELETE)\s+USING\s*\(\s*true\s*\)/gi)) {
      out.push(finding('SEC-001', 'aviso', 'Segurança', rel(f), lineOf(t, m.index),
        `Política RLS permite ${m[1]} de qualquer sala por qualquer pessoa (inclusive apagar a sala dos outros).`,
        'Restrinja ao criador da sala quando houver login obrigatório no multiplayer.'));
    }
  }
  return out;
}

export function runRules() {
  return [
    ...screensFlow(), ...routes(),
    ...keyboardGuards(), ...cleanups(), ...sideEffectsInUpdaters(), ...respawnOnWorldChange(),
    ...pointerLock(), ...escapeExits(), ...advertisedKeys(), ...realtimeThrottle(),
    ...dynamicLights(), ...cssImports(), ...englishStrings(), ...touchSupport(), ...hardcodedTotals(),
    ...authRules(), ...rlsPolicies(),
  ];
}
