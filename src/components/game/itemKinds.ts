import type { ItemType } from './types';

/** Ferramentas e armas ficam em pé na mão; blocos e coisas pequenas, deitadas na palma. */
export const isTool = (item: ItemType) => /_(sword|pickaxe|axe)$/.test(item) || item === 'lance' || item === 'torch' || item === 'stick';
