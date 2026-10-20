import { isTouchDevice } from './touchInput';

/**
 * Qualidade dos gráficos.
 * - alta: sombras de verdade, água com reflexo e mais detalhes (computador)
 * - baixa: sem sombras e resolução menor (celular e computadores fracos)
 */
export type GraphicsQuality = 'alta' | 'baixa';

const KEY = 'minefruits:graficos';

export function loadQuality(): GraphicsQuality {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'alta' || saved === 'baixa') return saved;
  } catch { /* sem memória do navegador */ }
  return isTouchDevice ? 'baixa' : 'alta';
}

export function saveQuality(q: GraphicsQuality) {
  try { localStorage.setItem(KEY, q); } catch { /* sem memória do navegador */ }
}
