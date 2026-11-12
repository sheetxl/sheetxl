/**
 * The font a piece of UI text is set in, as CSS has it.
 */
export interface UIFont {
  /** Font size in px. */
  size: number;
  /** The CSS font-family list, as the theme names it. */
  family: string;
  /** CSS font-weight; `normal` when unset. */
  weight?: string | number;
  /** CSS font-style; `normal` when unset. */
  style?: 'normal' | 'italic' | 'oblique';
}

let _context: CanvasRenderingContext2D | null | undefined;

const context = (): CanvasRenderingContext2D | null => {
  if (_context !== undefined) return _context;
  try {
    _context = typeof document === 'undefined' ? null : (document.createElement('canvas').getContext('2d') ?? null);
  } catch {
    _context = null;
  }
  return _context;
};

const quoteFamilies = (family: string): string =>
  family.split(',').map((f) => {
    const name = f.trim();
    return name.includes(' ') && !/^["']/.test(name) ? `"${name}"` : name;
  }).join(', ');

/**
 * The width in px the browser paints `text` at in a UI font: for sizing a control to a sample
 * label (a toolbar button to its widest value). Nothing to do with cells: spreadsheet text is
 * measured by the sdk's font collection, with Excel's numbers.
 *
 * @remarks
 * A cached canvas measures with the browser's own advances. Where there is no canvas (jsdom, a
 * server) the width is estimated from the character count, which is enough to size a control.
 */
export function measureUIText(text: string, font: UIFont): number {
  const ctx = context();
  if (!ctx) return text.length * font.size * 0.6;
  ctx.font = `${font.style ?? 'normal'} ${font.weight ?? 'normal'} ${font.size}px ${quoteFamilies(font.family || 'sans-serif')}`;
  return ctx.measureText(text).width;
}
