// Teste de fumaça: abre o jogo de verdade num navegador (Chromium headless)
// e percorre os fluxos principais procurando telas quebradas e erros de execução.
import { spawn } from 'node:child_process';
import { ROOT } from './utils.mjs';

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}`;

// Erros de rede do Supabase são esperados quando o teste roda sem internet: viram aviso.
const NETWORK_NOISE = /supabase|Failed to fetch|net::ERR_|ERR_NAME|WebSocket|realtime|Failed to load resource|fonts\.googleapis/i;

function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    shell: process.platform === 'win32',
    stdio: 'pipe',
    detached: process.platform !== 'win32',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('vite preview não respondeu em 30s: ' + JSON.stringify(log.slice(-300)))), 30000);
    const onData = (d) => {
      log += String(d).replace(/\x1b\[[0-9;]*m/g, '');
      if (/Local:/.test(log)) { clearTimeout(timer); resolve(child); }
      else if (/error when starting|EADDRINUSE|EAFNOSUPPORT/.test(log)) { clearTimeout(timer); reject(new Error(log.trim().split('\n').slice(0, 2).join(' '))); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`vite preview saiu com código ${code}`)));
  });
}

export async function runSmoke() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return { skipped: 'Playwright não instalado (npm i -D playwright && npx playwright install chromium).', findings: [], steps: [] };
  }

  const findings = [];
  const steps = [];
  const add = (rule, severity, category, message, fix) =>
    findings.push({ rule, severity, category, file: '(navegador)', line: 0, message, fix });

  let server;
  let browser;
  try {
    server = await startPreview();
    try {
      browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    } catch (e) {
      return { skipped: `Chromium indisponível (${e.message.split('\n')[0]}). Rode: npx playwright install chromium`, findings: [], steps: [] };
    }
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(5000);
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    const visible = (text, timeout = 4000) =>
      page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }).then(() => true, () => false);
    const gone = (text, timeout = 2000) =>
      page.getByText(text, { exact: false }).first().waitFor({ state: 'hidden', timeout }).then(() => true, () => false);

    // Cada passo: nome, função que devolve true/false, regra e mensagem se falhar.
    const step = async (name, fn, onFail) => {
      let ok = false;
      try { ok = await fn(); } catch (e) { ok = false; onFail = { ...onFail, message: `${onFail.message} (${e.message.split('\n')[0]})` }; }
      steps.push({ name, ok });
      if (!ok) add(onFail.rule, onFail.severity || 'erro', onFail.category, onFail.message, onFail.fix);
      return ok;
    };

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });

    const reachedLogin = await step('Abre a tela inicial',
      async () => (await visible('Jogar como visitante', 15000)) || (await visible('JOGAR', 1000)),
      { rule: 'RUN-001', category: 'Quebra de página', message: 'A página inicial não carregou (tela em branco ou travada em "Carregando...").' });
    if (!reachedLogin) throw new Error('stop');

    if (await visible('Jogar como visitante', 1000)) {
      await page.getByText('Jogar como visitante').click();
    }

    await step('Menu → escolher skin', async () => {
      await page.getByRole('button', { name: /JOGAR/ }).first().click();
      return visible('ESCOLHA SUA SKIN');
    }, { rule: 'RUN-002', category: 'Fluxo de navegação', message: 'Botão JOGAR não leva à escolha de skin.' });

    await step('Criar skin volta para a escolha com a skin nova selecionada', async () => {
      await page.getByText('Criar Skin').click();
      await visible('CRIAR SKIN');
      await page.getByPlaceholder('Nome da skin').fill('Auditoria');
      await page.getByText('SALVAR SKIN').click();
      return (await visible('ESCOLHA SUA SKIN', 3000)) && (await visible('Auditoria', 1000));
    }, { rule: 'RUN-003', category: 'Fluxo de navegação',
      message: 'Depois de salvar a skin o jogador volta para a tela de título em vez da escolha de skin, e a skin criada não fica selecionada.',
      fix: 'Volte para a escolha de skin mantendo a skin nova selecionada.' });

    if (!(await visible('ESCOLHA SUA SKIN', 500))) {
      await page.getByRole('button', { name: /JOGAR/ }).first().click().catch(() => {});
    }

    await step('Multiplayer → Voltar', async () => {
      await page.getByText('MULTIPLAYER').last().click();
      if (!(await visible('Criar Sala'))) return false;
      await page.getByText('VOLTAR').click();
      return (await visible('ESCOLHA SUA SKIN', 3000)) || (await visible('JOGAR', 500));
    }, { rule: 'RUN-004', category: 'Fluxo de navegação', message: 'Lobby do multiplayer não abre ou o botão Voltar não funciona.' });

    await step('Entrar no modo solo (canvas 3D)', async () => {
      if (!(await visible('SOLO', 500))) await page.getByRole('button', { name: /JOGAR/ }).first().click();
      await page.getByText('SOLO').click();
      await page.waitForSelector('canvas', { timeout: 15000 });
      await page.waitForTimeout(2500);
      return (await page.locator('canvas').count()) > 0;
    }, { rule: 'RUN-005', category: 'Quebra de página', message: 'O jogo 3D não abriu (canvas ausente ou erro no WebGL).' });

    await step('Partida começa jogável (sem menu travando a tela)', async () => {
      const blocking = ['PAUSADO', 'CRAFTING', 'LOJA DE ACESSÓRIOS', 'VOCÊ MORREU'];
      for (const t of blocking) if (await visible(t, 300)) return false;
      return true;
    }, { rule: 'RUN-013', category: 'Fluxo de navegação', message: 'A partida abre com um menu/pausa por cima: o jogador não consegue começar.' });

    const typeE = () => page.keyboard.press('e');
    await step('E abre o craft e ESC fecha', async () => {
      await typeE();
      if (!(await visible('CRAFTING'))) return false;
      await page.keyboard.press('Escape');
      return gone('CRAFTING');
    }, { rule: 'RUN-006', category: 'UX', message: 'O menu de craft mostra "ESC Fechar" mas a tecla ESC não fecha o menu.',
      fix: 'Esc deve fechar o menu aberto por cima.' });
    if (await visible('CRAFTING', 300)) await page.getByText('ESC Fechar').click().catch(() => {});

    await step('B abre a loja e ESC fecha', async () => {
      await page.keyboard.press('b');
      if (!(await visible('LOJA DE ACESSÓRIOS'))) return false;
      await page.keyboard.press('Escape');
      return gone('LOJA DE ACESSÓRIOS');
    }, { rule: 'RUN-007', category: 'UX', message: 'A loja mostra "ESC Fechar" mas a tecla ESC não fecha a loja.' });
    if (await visible('LOJA DE ACESSÓRIOS', 300)) await page.getByText('ESC Fechar').click().catch(() => {});

    await step('Digitar no chat não dispara atalhos do jogo', async () => {
      await page.keyboard.press('t');
      const input = page.getByPlaceholder('Digite uma mensagem...');
      await input.waitFor({ timeout: 3000 });
      await input.focus();
      await page.keyboard.type('bre e r', { delay: 20 });
      await page.waitForTimeout(300);
      // Procura os títulos dos menus (o rodapé do HUD também tem as palavras "craftar/ranking")
      const leaked = (await page.getByRole('heading', { name: /CRAFTING|LOJA DE ACESSÓRIOS|RANKING/ }).count()) > 0;
      await page.keyboard.press('Enter');
      return !leaked;
    }, { rule: 'RUN-008', category: 'Quebra de contexto', message: 'Digitar no chat abre craft/loja/ranking (atalhos vazam do campo de texto).' });

    await step('ESC dentro do chat fecha só o chat', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const chatClosed = await page.getByPlaceholder('Digite uma mensagem...')
        .waitFor({ state: 'detached', timeout: 1500 }).then(() => true, () => false);
      const stillInGame = (await page.locator('canvas').count()) > 0;
      return chatClosed && stillInGame;
    }, { rule: 'RUN-009', category: 'Quebra de contexto', message: 'ESC no chat não fecha o chat ou derruba o jogador para o menu.' });

    await step('ESC no jogo pausa em vez de sair direto', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const paused = await visible('PAUSADO', 1500);
      const kicked = (await page.locator('canvas').count()) === 0;
      if (kicked) return false;
      if (paused) {
        await page.getByText('Continuar').click();
        return gone('PAUSADO');
      }
      return false;
    }, { rule: 'RUN-010', category: 'Fluxo de navegação', message: 'ESC encerra a partida na hora, sem confirmação, e o progresso é perdido.',
      fix: 'Mostre um menu de pausa com Continuar / Sair.' });

    await step('Sair do jogo volta ao menu', async () => {
      if ((await page.locator('canvas').count()) === 0) return visible('JOGAR');
      await page.keyboard.press('Escape');
      if (await visible('PAUSADO', 1000)) await page.getByText('Sair para o menu').click();
      else await page.getByText('Sair').first().click();
      return visible('JOGAR', 5000);
    }, { rule: 'RUN-011', category: 'Fluxo de navegação', message: 'Não foi possível voltar do jogo para o menu.' });

    await step('Rota inexistente mostra 404 com volta', async () => {
      await page.goto(`${BASE}/rota-que-nao-existe`, { waitUntil: 'domcontentloaded' });
      return visible('404', 5000);
    }, { rule: 'RUN-012', category: 'Quebra de página', message: 'Rota inexistente não mostra página 404.' });

    for (const e of pageErrors) {
      add('RUN-020', 'erro', 'Erro de execução', `Erro JavaScript não tratado: ${e.slice(0, 220)}`, 'Veja o console do navegador.');
    }
    const seen = new Set();
    for (const raw of consoleErrors) {
      const e = raw.replace(/\?apikey=[^ ]+/, '?apikey=…');
      if (/404 Error: User attempted/.test(e) || seen.has(e.slice(0, 80))) continue;
      seen.add(e.slice(0, 80));
      const noise = NETWORK_NOISE.test(e);
      add('RUN-021', noise ? 'info' : 'aviso', noise ? 'Rede (ambiente de teste)' : 'Erro de execução', `console.error: ${e.slice(0, 220)}`, '');
    }
    return { findings, steps };
  } catch (e) {
    if (e.message !== 'stop') add('RUN-000', 'erro', 'Quebra de página', `Teste no navegador interrompido: ${e.message.split('\n')[0]}`, '');
    return { findings, steps };
  } finally {
    await browser?.close().catch(() => {});
    if (server) {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
      else { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } }
    }
  }
}
