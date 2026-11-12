import { type Plugin } from 'vite';
import { optimize } from 'svgo';

/**
 * Vite plugin: optimize the path data of icon packs authored as JSON (`icons/packs/*.json`).
 *
 * @remarks
 * A pack is authored as the drawing tool exported it — coordinates with six or more decimals, absolute
 * commands, redundant segments. This rewrites every `d` when the pack is imported, so the shipped pack
 * carries the same shapes in well under half the bytes and the source stays editable as exported.
 * Only the encoding changes: coordinates are rounded and commands re-spelled, never refit.
 *
 * Precision follows each glyph's viewBox: coordinates keep about a thousandth of the icon's size, which
 * is two decimals for the usual 24-unit box and below what any rendered size can show.
 *
 * Path styling is often applied by CSS class (a `line` class strokes a path), which the optimizer
 * cannot see, so every path is optimized as a stroked path with round caps. That keeps the rewrites
 * that are safe for fills and strokes alike.
 */
export function IconPackPlugin(): Plugin {
  return {
    name: 'vite-icon-pack',
    enforce: 'pre',
    transform(code: string, id: string) {
      const file = id.replace(/\?.*$/, '').split('\\').join('/');
      if (!/\/icons\/packs\/[^/]+\.json$/.test(file)) return null;
      const pack = JSON.parse(code);
      const defaultViewBox: string = pack.meta?.defaultViewBox ?? '0 0 24 24';
      for (const glyph of Object.values<any>(pack.icons ?? {})) {
        const svg = glyph?.svg;
        if (!svg || typeof svg !== 'object') continue;
        const paths: any[] = Array.isArray(svg) ? svg : svg.paths;
        if (!Array.isArray(paths)) continue;
        const viewBox: string = (!Array.isArray(svg) && svg.viewBox) || defaultViewBox;
        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          if (typeof path === 'string') {
            paths[i] = optimizePath(path, viewBox, id);
          } else if (path && typeof path.d === 'string') {
            path.d = optimizePath(path.d, viewBox, id);
          }
        }
      }
      return { code: JSON.stringify(pack), map: null };
    }
  };
}

const precisionFor = (viewBox: string): number => {
  const [, , width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
  const size = Math.max(width || 0, height || 0) || 24;
  return Math.max(0, Math.ceil(Math.log10(1000 / size)));
};

const optimizePath = (d: string, viewBox: string, id: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path stroke="#000" stroke-linecap="round" d="${d}"/></svg>`;
  const { data } = optimize(svg, {
    multipass: true,
    plugins: [{
      name: 'convertPathData',
      params: {
        floatPrecision: precisionFor(viewBox),
        // No refitting curves as arcs: it saves a little more but reshapes them (a drawn circle comes
        // back a few hundredths larger). svgo's types omit `false`; the plugin reads it as off.
        makeArcs: false as unknown as undefined
      }
    }]
  });
  const match = /\sd="([^"]*)"/.exec(data);
  if (!match) throw new Error(`[vite-icon-pack] could not optimize a path in ${id}`);
  return match[1];
};
