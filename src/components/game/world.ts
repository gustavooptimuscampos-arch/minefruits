import { BLOCK_COLORS, BlockType } from './types';

/** Lado de um chunk (pedaço do mapa que é redesenhado de uma vez). */
export const CHUNK = 16;
/** Altura máxima do mundo (y vai de 0 a WORLD_HEIGHT - 1). */
export const WORLD_HEIGHT = 64;

/** Todos os tipos de bloco, numerados. O id 0 é "ar". */
export const BLOCK_TYPES = Object.keys(BLOCK_COLORS) as BlockType[];
const ID_OF = new Map<BlockType, number>(BLOCK_TYPES.map((t, i) => [t, i + 1]));
export const blockId = (t: BlockType) => ID_OF.get(t)!;
export const WATER_ID = blockId('water');

/**
 * O mundo inteiro guardado num vetor de bytes (1 byte por bloco).
 * Antes era um objeto com uma chave de texto por bloco e o mapa todo era
 * copiado e redesenhado a cada bloco quebrado; num mapa grande isso travava.
 * Agora só o chunk que mudou é redesenhado.
 */
export class World {
  readonly size: number;
  readonly half: number;
  readonly chunksPerSide: number;
  private data: Uint8Array;
  /** Bloco mais alto de cada coluna (sem contar água); -1 se vazia. */
  private top: Int16Array;
  private chunkVersions: Int32Array;
  /** Meio de cada ravina (chão), usado para esconder a fruta das Trevas lá embaixo. */
  ravineSpots: [number, number, number][] = [];

  constructor(size: number) {
    this.size = size;
    this.half = size / 2;
    this.chunksPerSide = Math.ceil(size / CHUNK);
    this.data = new Uint8Array(size * size * WORLD_HEIGHT);
    this.top = new Int16Array(size * size).fill(-1);
    this.chunkVersions = new Int32Array(this.chunksPerSide * this.chunksPerSide);
  }

  inBounds(x: number, y: number, z: number) {
    return x >= -this.half && x < this.half && z >= -this.half && z < this.half && y >= 0 && y < WORLD_HEIGHT;
  }

  private col(x: number, z: number) {
    return (x + this.half) * this.size + (z + this.half);
  }

  /** Número do bloco (0 = ar). Fora do mapa também é ar. */
  getId(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.data[this.col(x, z) * WORLD_HEIGHT + y];
  }

  get(x: number, y: number, z: number): BlockType | undefined {
    const id = this.getId(x, y, z);
    return id ? BLOCK_TYPES[id - 1] : undefined;
  }

  /** Bloco sólido para andar/bater a cabeça (água e flor não contam). */
  isSolid(x: number, y: number, z: number): boolean {
    const t = this.get(x, y, z);
    return !!t && t !== 'water' && t !== 'flower';
  }

  /** Coloca (ou apaga, com null) um bloco e marca o chunk para redesenhar. */
  set(x: number, y: number, z: number, type: BlockType | null) {
    if (!this.inBounds(x, y, z)) return;
    const c = this.col(x, z);
    this.data[c * WORLD_HEIGHT + y] = type ? blockId(type) : 0;
    const isGround = !!type && type !== 'water';
    if (isGround && y > this.top[c]) this.top[c] = y;
    else if (!isGround && y === this.top[c]) this.recomputeTop(c, y);
    this.touch(x, z);
  }

  /** Versão rápida para a geração do mapa (não marca chunks; só mantém o topo). */
  rawSet(x: number, y: number, z: number, type: BlockType | null) {
    if (!this.inBounds(x, y, z)) return;
    const c = this.col(x, z);
    this.data[c * WORLD_HEIGHT + y] = type ? blockId(type) : 0;
    const isGround = !!type && type !== 'water';
    if (isGround && y > this.top[c]) this.top[c] = y;
    else if (!isGround && y === this.top[c]) this.recomputeTop(c, y);
  }

  rawSetIfEmpty(x: number, y: number, z: number, type: BlockType) {
    if (this.inBounds(x, y, z) && this.getId(x, y, z) === 0) this.rawSet(x, y, z, type);
  }

  /** Só coloca se o lugar estiver vazio (árvores não apagam o chão). */
  setIfEmpty(x: number, y: number, z: number, type: BlockType) {
    if (this.inBounds(x, y, z) && this.getId(x, y, z) === 0) this.set(x, y, z, type);
  }

  private recomputeTop(c: number, from: number) {
    let y = from;
    const base = c * WORLD_HEIGHT;
    while (y >= 0 && (this.data[base + y] === 0 || this.data[base + y] === WATER_ID)) y--;
    this.top[c] = y;
  }

  /** Altura do chão da coluna (topo + 1), como o antigo getGroundHeight. */
  groundHeight(x: number, z: number): number {
    const bx = Math.floor(x), bz = Math.floor(z);
    if (bx < -this.half || bx >= this.half || bz < -this.half || bz >= this.half) return 0;
    return this.top[this.col(bx, bz)] + 1;
  }

  /** Chão logo abaixo de uma altura (para andar dentro de cavernas). */
  floorBelow(x: number, fromY: number, z: number): number {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let y = Math.min(WORLD_HEIGHT - 1, Math.floor(fromY)); y >= 0; y--) {
      if (this.isSolid(bx, y, bz)) return y + 1;
    }
    return 0;
  }

  // ── Versões por chunk: o Terrain só redesenha o que mudou ──
  chunkIndex(cx: number, cz: number) {
    return cx * this.chunksPerSide + cz;
  }

  chunkVersion(cx: number, cz: number) {
    return this.chunkVersions[this.chunkIndex(cx, cz)];
  }

  private bump(cx: number, cz: number) {
    if (cx < 0 || cz < 0 || cx >= this.chunksPerSide || cz >= this.chunksPerSide) return;
    this.chunkVersions[this.chunkIndex(cx, cz)]++;
  }

  private touch(x: number, z: number) {
    const lx = x + this.half, lz = z + this.half;
    const cx = Math.floor(lx / CHUNK), cz = Math.floor(lz / CHUNK);
    this.bump(cx, cz);
    // Bloco na borda: o chunk vizinho também mostra uma face nova
    if (lx % CHUNK === 0) this.bump(cx - 1, cz);
    if (lx % CHUNK === CHUNK - 1) this.bump(cx + 1, cz);
    if (lz % CHUNK === 0) this.bump(cx, cz - 1);
    if (lz % CHUNK === CHUNK - 1) this.bump(cx, cz + 1);
  }

  /** Limites (em blocos) de um chunk. */
  chunkBounds(cx: number, cz: number) {
    const x0 = cx * CHUNK - this.half, z0 = cz * CHUNK - this.half;
    return { x0, z0, x1: Math.min(x0 + CHUNK, this.half), z1: Math.min(z0 + CHUNK, this.half) };
  }

  /** Coluna mais alta (inclui água) dentro de um chunk, para limitar o desenho. */
  chunkMaxY(cx: number, cz: number, waterLevel: number) {
    const { x0, z0, x1, z1 } = this.chunkBounds(cx, cz);
    let max = waterLevel;
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) max = Math.max(max, this.top[this.col(x, z)]);
    return Math.min(WORLD_HEIGHT - 1, max + 1);
  }

  /** Quantidade de blocos (para testes). */
  countBlocks(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (let i = 0; i < this.data.length; i++) {
      const id = this.data[i];
      if (id) counts[BLOCK_TYPES[id - 1]] = (counts[BLOCK_TYPES[id - 1]] || 0) + 1;
    }
    return counts;
  }
}
