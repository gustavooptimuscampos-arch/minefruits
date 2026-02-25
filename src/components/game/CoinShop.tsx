import { useState } from 'react';
import { COIN_PACKS, SHOP_ITEMS, ShopItem, AccessoryType } from './types';

interface CoinShopProps {
  coins: number;
  ownedItems: string[];
  equippedItems: Record<string, string | null>;
  onClose: () => void;
  onPurchaseItem: (itemId: string, cost: number) => boolean;
  onEquipItem: (itemId: string) => void;
  onUnequipItem: (type: AccessoryType) => void;
}

const TABS: { key: AccessoryType | 'buy' | 'all'; label: string }[] = [
  { key: 'all', label: '🛒 Todos' },
  { key: 'hat', label: '🎩 Chapéus' },
  { key: 'cape', label: '🧣 Capas' },
  { key: 'aura', label: '✨ Auras' },
  { key: 'body_color', label: '🎨 Cores' },
  { key: 'buy', label: '🪙 Comprar' },
];

export function CoinShop({ coins, ownedItems, equippedItems, onClose, onPurchaseItem, onEquipItem, onUnequipItem }: CoinShopProps) {
  const [tab, setTab] = useState<string>('all');
  const [purchaseMessage, setPurchaseMessage] = useState('');

  const showMessage = (msg: string, duration = 2000) => {
    setPurchaseMessage(msg);
    setTimeout(() => setPurchaseMessage(''), duration);
  };

  const handleBuy = (item: ShopItem) => {
    if (ownedItems.includes(item.id)) {
      // Already owned — equip/unequip
      const equipped = equippedItems[item.type];
      if (equipped === item.id) {
        onUnequipItem(item.type);
        showMessage('🔄 Desequipado!');
      } else {
        onEquipItem(item.id);
        showMessage('✅ Equipado!');
      }
      return;
    }
    if (onPurchaseItem(item.id, item.cost)) {
      showMessage('✅ Comprado e equipado!');
    } else {
      showMessage('❌ VoxelCoins insuficientes!');
    }
  };

  const filteredItems = tab === 'all'
    ? SHOP_ITEMS.filter(i => ['hat', 'cape', 'aura', 'body_color'].includes(i.type))
    : SHOP_ITEMS.filter(i => i.type === tab);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm" style={{ zIndex: 50 }}>
      <div className="bg-background border border-border rounded-xl p-4 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="font-pixel text-lg text-primary">🪙 LOJA DE ACESSÓRIOS</h2>
            <p className="text-xs font-game text-muted-foreground mt-1">
              Saldo: <span className="text-secondary font-bold">{coins} VoxelCoins</span>
            </p>
          </div>
          <button onClick={onClose} className="font-pixel text-xs px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80">
            ESC Fechar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`font-game text-[10px] px-3 py-1.5 rounded-lg transition-colors ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Purchase message */}
        {purchaseMessage && (
          <div className="mb-3 p-2 bg-muted/30 rounded-lg text-center">
            <span className="text-sm font-game text-foreground">{purchaseMessage}</span>
          </div>
        )}

        {tab !== 'buy' ? (
          <div className="space-y-2">
            {filteredItems.map(item => {
              const owned = ownedItems.includes(item.id);
              const equipped = equippedItems[item.type] === item.id;
              const canAfford = coins >= item.cost;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    equipped
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/30 bg-muted/10'
                  }`}
                >
                  {/* Color preview */}
                  {item.color && (
                    <div
                      className="w-8 h-8 rounded-md flex-shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: item.emissive ? `0 0 10px ${item.emissive}` : undefined,
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-game text-foreground">{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] font-game text-muted-foreground">{item.description}</p>
                    )}
                    <p className="text-xs font-game text-secondary">🪙 {item.cost} VoxelCoins</p>
                  </div>
                  <button
                    onClick={() => handleBuy(item)}
                    disabled={!owned && !canAfford}
                    className={`font-pixel text-[10px] px-3 py-2 rounded-lg transition-all flex-shrink-0 ${
                      equipped
                        ? 'bg-primary text-primary-foreground'
                        : owned
                          ? 'bg-secondary text-secondary-foreground hover:scale-105 active:scale-95'
                          : canAfford
                            ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                            : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {equipped ? '✓ Equipado' : owned ? 'Equipar' : 'Comprar'}
                  </button>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="text-center text-sm font-game text-muted-foreground py-4">Nenhum item nesta categoria</p>
            )}
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
                    showMessage(`💳 Pagamento de ${pack.priceLabel} — Em breve!`, 3000);
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
