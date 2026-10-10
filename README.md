# Gustavo's Hello

OLA MEU NOME E GUSTAVO

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://minefruits.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/291f8d22-22a4-4876-bd4c-0f0ee97bf59b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Auditor do jogo

Antes de cada push, rode o auditor. Ele confere o jogo inteiro e gera `audit-report.md`:

```sh
npm run audit            # tudo: tipos, lint, regras do jogo, build, testes e jogo aberto no navegador
npm run audit -- --quick # só as checagens rápidas (sem build e sem navegador)
npm run audit:fix        # aplica as correções automáticas seguras (lint) e audita de novo
```

O que ele verifica:

- **Sintaxe e tipos** — erros de TypeScript e código morto (imports e variáveis sem uso).
- **Navegação** — toda tela tem caminho de volta, rotas e links apontam para lugares que existem.
- **Quebra de contexto** — atalhos de teclado que vazam de campos de texto, listeners/timers/canais sem limpeza, efeitos colaterais dentro de `setState`.
- **Fluxo do jogo** — spawn que teleporta o jogador, mouse preso em menus, ESC que encerra a partida, teclas anunciadas na tela sem programação.
- **Multiplayer, desempenho, UX, cadastro e segurança** — limite de envio no Realtime, luzes por item, fonte que não carrega, textos em inglês, aviso para celular, filtro de nomes, RLS.
- **Teste no navegador** — abre o jogo de verdade (Chromium) e percorre os fluxos: menu → skin → criar skin → multiplayer → solo → craft/loja/chat/pausa → sair → página 404.

Para o teste no navegador, instale o Chromium uma vez: `npx playwright install chromium`.
O comando termina com código 1 quando há erro, então serve também para CI.
