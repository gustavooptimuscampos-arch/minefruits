import { CRAFT_RECIPES, FOOD_VALUES, ITEM_CONFIG, Item, ItemType } from './types';

interface CraftingUIProps {
  items: Item[];
  canCraft: (index: number) => boolean;
  onCraft: (index: number) => void;
  /** Comer uma comida do inventário. */
  onEat?: (type: ItemType) => void;
  onClose: () => void;
}

export function CraftingUI({ items, canCraft, onCraft, onEat, onClose }: CraftingUIProps) {
  const categories = ['weapon', 'tool', 'block', 'misc'] as const;
  const categoryLabels = { weapon: '⚔️ Armas', tool: '⛏️ Ferramentas', block: '🧱 Blocos', misc: '📦 Outros' };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm" style={{ zIndex: 50 }}>
      <div className="bg-background border border-border rounded-xl p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-pixel text-lg text-primary">🔨 CRAFTING</h2>
          <button onClick={onClose} className="font-pixel text-xs px-3 py-1 bg-muted text-muted-foreground rounded hover:bg-muted/80">
            ESC Fechar
          </button>
        </div>

        {/* Inventory display */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/30">
          <p className="font-game text-xs text-muted-foreground mb-2">📦 Inventário:</p>
          <div className="flex flex-wrap gap-1.5">
            {items.length === 0 ? (
              <span className="text-xs font-game text-muted-foreground/50">Vazio</span>
            ) : (
              items.map(item => {
                const config = ITEM_CONFIG[item.type];
                return (
                  FOOD_VALUES[item.type] && onEat ? (
                    <button
                      key={item.type}
                      title={`Comer ${config.label} (+${FOOD_VALUES[item.type]} de fome)`}
                      onClick={() => onEat(item.type)}
                      className="flex items-center gap-1 bg-orange-900/30 hover:bg-orange-800/40 rounded px-2 py-1 border border-orange-400/40"
                    >
                      <span className="text-sm">{config.emoji}</span>
                      <span className="text-xs font-game text-foreground">{item.count}</span>
                      <span className="text-[10px] font-game text-orange-200">{config.label} · Comer</span>
                    </button>
                  ) : (
                    <div key={item.type} title={config.label} className="flex items-center gap-1 bg-background/60 rounded px-2 py-1 border border-border/30">
                    <span className="text-sm">{config.emoji}</span>
                    <span className="text-xs font-game text-foreground">{item.count}</span>
                    <span className="text-[10px] font-game text-muted-foreground">{config.label}</span>
                  </div>
                  )
                );
              })
            )}
          </div>
        </div>

        {/* Recipes by category */}
        {categories.map(cat => {
          const recipes = CRAFT_RECIPES.map((r, i) => ({ ...r, index: i })).filter(r => r.category === cat);
          if (recipes.length === 0) return null;
          return (
            <div key={cat} className="mb-4">
              <p className="font-game text-sm text-muted-foreground mb-2">{categoryLabels[cat]}</p>
              <div className="grid grid-cols-1 gap-1.5">
                {recipes.map(recipe => {
                  const craftable = canCraft(recipe.index);
                  const resultConfig = ITEM_CONFIG[recipe.result];
                  return (
                    <button
                      key={recipe.index}
                      onClick={() => { if (craftable) onCraft(recipe.index); }}
                      disabled={!craftable}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors text-left ${
                        craftable
                          ? 'border-primary/50 bg-primary/10 hover:bg-primary/20 cursor-pointer'
                          : 'border-border/20 bg-muted/10 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-lg">{resultConfig.emoji}</span>
                      <div className="flex-1">
                        <span className="text-xs font-game text-foreground">{recipe.label}</span>
                        {recipe.resultCount > 1 && <span className="text-xs font-game text-muted-foreground ml-1">x{recipe.resultCount}</span>}
                        <div className="flex gap-1 mt-0.5">
                          {Object.entries(recipe.ingredients).map(([item, count]) => {
                            const ic = ITEM_CONFIG[item as ItemType];
                            return (
                              <span key={item} className="text-[10px] font-game text-muted-foreground">
                                {ic.emoji}{count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      {craftable && (
                        <span className="text-xs font-game text-primary">Craftar</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
