import { useState } from 'react';
import { promptInstall, useInstallState } from '@/lib/pwa';

/** Botão "Baixar o jogo": instala o MineFruits como app, com ícone na tela do celular. */
export function InstallButton() {
  const { canPrompt, installed, ios } = useInstallState();
  const [help, setHelp] = useState(false);

  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (ok) return;
    }
    setHelp(true);
  };

  return (
    <>
      <button
        onClick={onClick}
        className="font-pixel text-[10px] px-3 py-1.5 bg-secondary text-secondary-foreground rounded shadow-lg hover:opacity-90 active:scale-95 transition"
      >
        📲 Baixar o jogo
      </button>

      {help && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setHelp(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-5 w-full max-w-sm text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
              <h2 className="font-pixel text-sm text-primary leading-relaxed">Colocar o MineFruits no celular</h2>
            </div>

            {ios ? (
              <ol className="font-game text-base text-foreground space-y-2 list-decimal list-inside">
                <li>Abra este site no <b>Safari</b>.</li>
                <li>Toque em <b>Compartilhar</b> (o quadrado com a setinha ⬆️).</li>
                <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
                <li>Toque em <b>Adicionar</b>. Pronto! 🎉</li>
              </ol>
            ) : (
              <ol className="font-game text-base text-foreground space-y-2 list-decimal list-inside">
                <li>Abra este site no <b>Chrome</b> do celular.</li>
                <li>Toque nos <b>3 pontinhos ⋮</b> lá em cima.</li>
                <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
                <li>Toque em <b>Instalar</b>. Pronto! 🎉</li>
              </ol>
            )}

            <p className="font-game text-sm text-muted-foreground mt-4">
              O ícone do MineFruits vai aparecer junto dos seus outros apps.
            </p>
            <button
              onClick={() => setHelp(false)}
              className="mt-4 w-full font-pixel text-xs py-3 bg-primary text-primary-foreground rounded-lg"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
