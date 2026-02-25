import { useState } from 'react';
import { COIN_PACKS, SHOP_ITEMS } from './types';

interface CoinShopProps {
  coins: number;
  onClose: () => void;
  onPurchaseItem: (itemId: string, cost: number) => boolean;
}

export function CoinShop({ coins, onClose, onPurchaseItem }: CoinShopProps) {
  const [tab, setTab] = useState<'shop' | 'buy'>('shop');
  const [purchaseMessage, setPurchaseMessage] = useState('');

  const handleBuy = (itemId: string, cost: number) => {
    if (onPurchaseItem(itemId, cost)) {
      setPurchaseMessage('✅ Comprado com sucesso!');
    } else {
      setPurchaseMessage('❌ VoxelCoins insuficientes!');
    }
    setTimeout(() => setPurchaseMessage(''), 2000);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm" style={{ zIndex: 50 }}>
      <div className="bg-background border border-border rounded-xl p-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-pixel text-lg text-primary">🪙 LOJA</h2>
            <p className="text-xs font-game text-muted-foreground mt-1">
              Saldo: <span className="text-secondary font-bold">{coins} VoxelCoins</span>
            </p>
          </div>
          <button onClick={onClose} className="font-pixel text-xs px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80">
            ESC Fechar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('shop')}
            className={`font-game text-xs px-4 py-2 rounded-lg transition-colors ${
              tab === 'shop' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            🛒 Itens
          </button>
          <button
            onClick={() => setTab('buy')}
            className={`font-game text-xs px-4 py-2 rounded-lg transition-colors ${
              tab === 'buy' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            🪙 Comprar Moedas
          </button>
        </div>

        {/* Purchase message */}
        {purchaseMessage && (
          <div className="mb-3 p-2 bg-muted/30 rounded-lg text-center">
            <span className="text-sm font-game text-foreground">{purchaseMessage}</span>
          </div>
        )}

        {tab === 'shop' ? (
          <div className="space-y-2">
            {SHOP_ITEMS.map(item => {
              const canAfford = coins >= item.cost;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10"
                >
                  <div>
                    <p className="text-sm font-game text-foreground">{item.name}</p>
                    <p className="text-xs font-game text-secondary">🪙 {item.cost} VoxelCoins</p>
                  </div>
                  <button
                    onClick={() => handleBuy(item.id, item.cost)}
                    disabled={!canAfford}
                    className={`font-pixel text-xs px-4 py-2 rounded-lg transition-all ${
                      canAfford
                        ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                        : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
                    }`}
                  >
                    Comprar
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-game text-muted-foreground mb-3">
              1 pacote = R$ 4,00 para 100 VoxelCoins. Pacotes maiores incluem bônus!
            </p>
            {COIN_PACKS.map(pack => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-3 rounded-lg border border-secondary/30 bg-secondary/5"
              >
                <div>
                  <p className="text-sm font-game text-foreground">🪙 {pack.description}</p>
                </div>
                <button
                  className="font-pixel text-xs px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:scale-105 transition-transform active:scale-95"
                  onClick={() => {
                    setPurchaseMessage(`💳 Pagamento de ${pack.priceLabel} — Em breve!`);
                    setTimeout(() => setPurchaseMessage(''), 3000);
                  }}
                >
                  {pack.priceLabel}
                </button>
              </div>
            ))}
            <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border/20">
              <p className="text-[10px] font-game text-muted-foreground text-center">
                💡 Você também ganha VoxelCoins coletando moedas no mapa e matando mobs!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
