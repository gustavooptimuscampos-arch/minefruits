// Utilitários compartilhados pelo auditor do Mine Fruits.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath lida com espaços ("Mine Fruits") e com caminhos do Windows (C:\...)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Roda um comando e devolve { code, out }. Funciona no Windows e no Linux. */
export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return { code: res.status ?? 1, out: `${res.stdout || ''}${res.stderr || ''}` };
}

/** Lista arquivos recursivamente com as extensões pedidas. */
export function listFiles(dir, exts) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (exts.some((e) => entry.name.endsWith(e))) out.push(p);
    }
  };
  walk(abs);
  return out;
}

export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
export const read = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8');

/** Número da linha (1-based) de um índice no texto. */
export function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * A partir de `openIndex` (posição de um "{" ou "("), devolve o índice do
 * fechamento correspondente, ignorando strings e comentários simples.
 */
export function matchBrace(text, openIndex) {
  const open = text[openIndex];
  const close = open === '{' ? '}' : open === '(' ? ')' : ']';
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    const prev = text[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i); if (i < 0) return -1; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Encontra todos os blocos useEffect(() => { ... }, [deps]) de um arquivo. */
export function findEffects(text) {
  const effects = [];
  const re = /useEffect\(\s*\(\s*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const bodyStart = m.index + m[0].length - 1;
    const bodyEnd = matchBrace(text, bodyStart);
    if (bodyEnd < 0) continue;
    const after = text.slice(bodyEnd + 1, bodyEnd + 300);
    const deps = /^\s*,\s*\[([^\]]*)\]/.exec(after);
    effects.push({
      index: m.index,
      body: text.slice(bodyStart, bodyEnd + 1),
      deps: deps ? deps[1].split(',').map((s) => s.trim()).filter(Boolean) : null,
    });
  }
  return effects;
}
