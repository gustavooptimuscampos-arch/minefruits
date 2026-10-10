#!/usr/bin/env node
// Auditor do Mine Fruits
// Uso:
//   npm run audit            → auditoria completa (tipos, lint, regras do jogo, build, testes, navegador)
//   npm run audit -- --fix   → corrige automaticamente o que for seguro (lint) e audita de novo
//   npm run audit -- --quick → só checagens rápidas (sem build e sem navegador)
//   npm run audit -- --no-smoke → tudo menos o teste no navegador
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, run, read } from './utils.mjs';
import { runRules } from './rules.mjs';
import { runSmoke } from './smoke.mjs';

const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');
const QUICK = args.has('--quick');
const SMOKE = !QUICK && !args.has('--no-smoke');

const findings = [];
const phases = [];
const add = (f) => findings.push(f);
const t0 = Date.now();

function phase(name, fn) {
  const start = Date.now();
  process.stdout.write(`• ${name}... `);
  const before = findings.length;
  let status = 'ok';
  try {
    const r = fn();
    if (r === 'skip') status = 'pulado';
  } catch (e) {
    status = 'falhou';
    add({ rule: 'AUD-000', severity: 'erro', category: 'Auditor', file: '-', line: 0, message: `${name}: ${e.message}`, fix: '' });
  }
  const n = findings.length - before;
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`${status === 'ok' ? (n ? `${n} achado(s)` : 'ok') : status} (${secs}s)`);
  phases.push({ name, status, count: n, secs });
}

// 1) Dependências: package-lock.json em sincronia com package.json
phase('Dependências', () => {
  const pkg = JSON.parse(read('package.json'));
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return;
  const lockRoot = JSON.parse(read('package-lock.json')).packages?.[''] || {};
  for (const field of ['dependencies', 'devDependencies']) {
    const want = pkg[field] || {};
    const have = lockRoot[field] || {};
    const diff = Object.keys({ ...want, ...have }).filter((k) => want[k] !== have[k]);
    if (diff.length) {
      add({ rule: 'DEP-001', severity: 'erro', category: 'Dependências', file: 'package-lock.json', line: 1,
        message: `package-lock.json fora de sincronia com package.json em ${field}: ${diff.slice(0, 6).join(', ')}${diff.length > 6 ? '…' : ''}. "npm ci" falha.`,
        fix: 'Rode "npm install" e faça commit do package-lock.json.' });
    }
  }
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    add({ rule: 'DEP-002', severity: 'erro', category: 'Dependências', file: '-', line: 0,
      message: 'node_modules não existe.', fix: 'Rode "npm install".' });
  }
});

// 2) Sintaxe e tipos (TypeScript)
phase('Sintaxe e tipos (TypeScript)', () => {
  const parse = (out, severity, category, extra) => {
    for (const m of out.matchAll(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/gm)) {
      const file = m[1].replace(/\\/g, '/');
      if (file.includes('components/ui/')) continue;
      add({ rule: m[3], severity, category, file, line: Number(m[2]), message: m[4], fix: extra });
    }
  };
  const strictOut = run('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit']);
  parse(strictOut.out, 'erro', 'Sintaxe / tipos', 'Corrija o erro de tipo.');
  const unused = run('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit', '--noUnusedLocals']);
  const unusedOnly = unused.out.split('\n').filter((l) => /TS6133|TS6196|TS6192/.test(l)).join('\n');
  parse(unusedOnly, 'aviso', 'Código morto', 'Remova o que não é usado (ou use, se era para usar).');
});

// 3) Lint (ESLint) — com --fix aplica as correções automáticas antes
phase(FIX ? 'Lint (ESLint) com correção automática' : 'Lint (ESLint)', () => {
  const eslintArgs = ['eslint', '.', '-f', 'json'];
  if (FIX) eslintArgs.push('--fix');
  const res = run('npx', eslintArgs);
  const start = res.out.indexOf('[');
  if (start < 0) throw new Error(res.out.slice(0, 300));
  const results = JSON.parse(res.out.slice(start, res.out.lastIndexOf(']') + 1));
  for (const r of results) {
    for (const msg of r.messages) {
      const file = path.relative(ROOT, r.filePath).split(path.sep).join('/');
      // Código gerado (shadcn/ui e integração do Lovable) não é mexido à mão: vira aviso
      const isUiLib = file.startsWith('src/components/ui/') || file.startsWith('src/integrations/');
      add({
        rule: msg.ruleId || 'eslint',
        severity: msg.severity === 2 && !isUiLib ? 'erro' : 'aviso',
        category: msg.ruleId?.startsWith('react-hooks') ? 'Quebra de contexto' : 'Qualidade de código',
        file, line: msg.line || 0, message: msg.message,
        fix: msg.fix ? 'Corrigível com --fix.' : '',
      });
    }
  }
});

// 4) Regras do jogo (navegação, contexto, fluxo, UX, multiplayer, cadastro)
phase('Regras do jogo', () => { runRules().forEach(add); });

// 5) Build de produção
phase('Build de produção (Vite)', () => {
  if (QUICK) return 'skip';
  const res = run('npx', ['vite', 'build']);
  if (res.code !== 0) {
    add({ rule: 'BUILD-001', severity: 'erro', category: 'Quebra de página', file: '-', line: 0,
      message: `Build falhou: ${res.out.split('\n').filter((l) => /error/i.test(l)).slice(0, 3).join(' | ')}`, fix: 'Veja "npx vite build".' });
    return;
  }
  if (/@import must precede/.test(res.out)) {
    add({ rule: 'BUILD-002', severity: 'erro', category: 'UX', file: 'src/index.css', line: 1,
      message: 'O build avisa que o @import da fonte está fora de ordem: a fonte não carrega em produção.', fix: 'Mova o @import para o topo.' });
  }
  const big = [...res.out.matchAll(/dist\/assets\/(\S+\.js)\s+([\d,.]+) kB/g)].filter((m) => parseFloat(m[2].replace(',', '')) > 1500);
  for (const m of big) {
    add({ rule: 'BUILD-003', severity: 'aviso', category: 'Desempenho', file: `dist/assets/${m[1]}`, line: 0,
      message: `Pacote JavaScript de ${m[2]} kB: a primeira abertura do jogo fica lenta em internet fraca.`,
      fix: 'Carregue o jogo 3D sob demanda (React.lazy) para a tela inicial abrir antes.' });
  }
});

// 6) Testes automatizados
phase('Testes (Vitest)', () => {
  if (QUICK) return 'skip';
  const res = run('npx', ['vitest', 'run']);
  if (res.code !== 0) {
    add({ rule: 'TEST-001', severity: 'erro', category: 'Testes', file: '-', line: 0,
      message: `Testes falhando: ${res.out.split('\n').filter((l) => /FAIL|✗|×/.test(l)).slice(0, 4).join(' | ')}`, fix: 'Rode "npm test".' });
  }
});

// 7) Teste no navegador (precisa do build)
let smoke = { steps: [] };
if (SMOKE) {
  process.stdout.write('• Teste no navegador (fluxos do jogo)... ');
  const s = Date.now();
  smoke = await runSmoke();
  if (smoke.skipped) {
    console.log(`pulado: ${smoke.skipped}`);
    phases.push({ name: 'Teste no navegador', status: 'pulado', count: 0, secs: '0' });
  } else {
    smoke.findings.forEach(add);
    const ok = smoke.steps.filter((x) => x.ok).length;
    console.log(`${ok}/${smoke.steps.length} fluxos ok (${((Date.now() - s) / 1000).toFixed(1)}s)`);
    phases.push({ name: 'Teste no navegador', status: 'ok', count: smoke.findings.length, secs: ((Date.now() - s) / 1000).toFixed(1) });
  }
}

// ───────────── Relatório ─────────────
const order = { erro: 0, aviso: 1, info: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category) || a.file.localeCompare(b.file) || a.line - b.line);
const count = (s) => findings.filter((f) => f.severity === s).length;
const errors = count('erro');
const warnings = count('aviso');

const byCategory = {};
for (const f of findings) (byCategory[f.category] ||= []).push(f);

const icon = { erro: '❌', aviso: '⚠️', info: 'ℹ️' };
let md = `# Relatório de auditoria — Mine Fruits\n\n`;
md += `Gerado em ${new Date().toLocaleString('pt-BR')} · ${((Date.now() - t0) / 1000).toFixed(0)}s\n\n`;
md += `**${errors} erro(s) · ${warnings} aviso(s)**${errors === 0 ? ' — nenhum erro bloqueante ✅' : ''}\n\n`;
md += `| Etapa | Resultado |\n|---|---|\n`;
for (const p of phases) md += `| ${p.name} | ${p.status === 'ok' ? (p.count ? `${p.count} achado(s)` : 'ok') : p.status} |\n`;
if (smoke.steps?.length) {
  md += `\n## Fluxos testados no navegador\n\n`;
  for (const s of smoke.steps) md += `- ${s.ok ? '✅' : '❌'} ${s.name}\n`;
}
for (const [cat, list] of Object.entries(byCategory)) {
  md += `\n## ${cat}\n\n`;
  for (const f of list) {
    const where = f.file === '-' || f.file === '(navegador)' ? f.file : `\`${f.file}${f.line ? `:${f.line}` : ''}\``;
    md += `- ${icon[f.severity]} **${f.rule}** ${where} — ${f.message}${f.fix ? `  \n  ↳ ${f.fix}` : ''}\n`;
  }
}
fs.writeFileSync(path.join(ROOT, 'audit-report.md'), md);
fs.writeFileSync(path.join(ROOT, 'audit-report.json'), JSON.stringify({ errors, warnings, phases, smoke: smoke.steps, findings }, null, 2));

console.log('');
for (const f of findings.filter((x) => x.severity !== 'info')) {
  const where = f.file === '-' || f.file === '(navegador)' ? f.file : `${f.file}${f.line ? `:${f.line}` : ''}`;
  console.log(`${f.severity === 'erro' ? 'ERRO ' : 'AVISO'} [${f.rule}] ${where}\n      ${f.message}`);
}
console.log(`\nResultado: ${errors} erro(s), ${warnings} aviso(s). Relatório completo em audit-report.md`);
process.exit(errors > 0 ? 1 : 0);
