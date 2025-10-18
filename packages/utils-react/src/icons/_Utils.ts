import type {
  IconGlyphKey, IconPack, IconPath, IconGlyph, SvgSourceInput, SvgSource,
  IconGlyphInput, IconPackInput, IconPackMeta
} from './Types';

function normalizeSvgSource(input: SvgSourceInput): SvgSource {
  if (typeof input === "function") return input;  // SvgRender
  // String input: can be (a) data: URL, (b) full <svg> markup, (c) <path> tag, (d) raw 'd' string
  if (typeof input === "string") {
    const raw = input.trim();

    // (a) data:image/svg+xml[;…][;base64],…  → decode to markup first
    if (raw.startsWith("data:image/svg+xml")) {
      const decoded = decodeSvgDataUrl(raw);
      if (decoded) return parseSvgMarkup(decoded);
      // fall back to trying as-is if decoding somehow failed
    }

    // (b) full <svg>… or (c) <path …>
    if (raw.startsWith("<")) {
      if (/^<\s*svg\b/i.test(raw)) {
        return parseSvgMarkup(raw);
      }
      if (/^<\s*path\b/i.test(raw)) {
        const d = extractPathDFromPathTag(raw);
        if (d) return { paths: [{ d }] };
      }
      // Unknown XML-ish string: treat as a single path 'd' to be forgiving
      return { paths: [{ d: raw }] };
    }

    // (d) bare path data
    return { paths: [{ d: raw }] };
  }

  // Array input: allow array of 'd' strings (and optionally ignore path tags)
  if (Array.isArray(input)) {
    const paths: IconPath[] = [];
    for (const item of input) {
      if (typeof item === "string") {
        const s = String(item).trim();
        if (s.startsWith("<path")) {
          const d = extractPathDFromPathTag(s);
          if (d) paths.push({ d });
        } else {
          paths.push({ d: s });
        }
      } else if (item && typeof item === "object" && "d" in item && typeof item.d === "string") {
        paths.push({ ...item });
      }
    }
    return { paths };
  }

  // Already canonical
  return input;
}

// Minimal <path ...> parser (safe: only extracts attributes we care about)
function extractPathDFromPathTag(tag: string): string | null {
  const m = /\bd\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(tag);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function normalizeGlyphInput(g: IconGlyphInput): IconGlyph {
  if ("svg" in g) {
    return { ...g, svg: normalizeSvgSource(g.svg) } as IconGlyph;
  }
  if ("url" in g) {
    const u = typeof g.url === "string" ? { src: g.url } : g.url;
    return { ...g, url: u } as IconGlyph;
  }
  if ("emoji" in g) {
    const e = typeof g.emoji === "string" ? g.emoji : g.emoji.text;
    return { ...g, emoji: e } as IconGlyph;
  }
  if ('react' in g) {
    // nothing to normalize; just pass through
    return g;
  }
  return g as IconGlyph;
}

// Robust (no-dep) SVG markup parser with DOMParser fallback
function parseSvgMarkup(markup: string): SvgSource {
  // Try DOMParser in the browser
  try {
    // @ts-ignore
    if (typeof DOMParser !== "undefined") {
      // @ts-ignore
      const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
      const svgEl = doc.querySelector("svg");
      const viewBox = svgEl?.getAttribute("viewBox") ?? undefined;
      const paths: IconPath[] = [];
      doc.querySelectorAll("path").forEach((el: Element) => {
        const d = el.getAttribute("d");
        if (!d) return;
        const p: IconPath = { d };
        const cls = el.getAttribute("class"); if (cls) p.className = cls;
        const fill = el.getAttribute("fill"); if (fill && fill !== "none") p.fill = fill;
        const stroke = el.getAttribute("stroke"); if (stroke) p.stroke = stroke;
        const opacity = el.getAttribute("opacity"); if (opacity) p.opacity = Number(opacity);
        const fr = el.getAttribute("fill-rule") as any; if (fr) p.fillRule = fr;
        const cr = el.getAttribute("clip-rule") as any; if (cr) p.clipRule = cr;
        paths.push(p);
      });
      return { viewBox, paths };
    }
  } catch { /* fall through */ }

  // Fallback: naive regex (SSR / no DOMParser)
  const viewBoxMatch = markup.match(/viewBox="([^"]+)"/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : undefined;
  const paths: IconPath[] = [];
  const re = /<path\b[^>]*\sd="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    paths.push({ d: m[1] });
  }
  return { viewBox, paths };
}

function decodeSvgDataUrl(input: string): string | null {
  const m = /^data:image\/svg\+xml(;[^,]*)?,(.*)$/i.exec(input.trim());
  if (!m) return null;
  const params = m[1] || "";
  const payload = m[2] || "";
  try {
    if (/;base64/i.test(params)) {
      // Base64 → UTF-8 string (browser or Node)
      if (typeof atob !== "undefined") {
        const bin = atob(payload);
        const binLength = bin.length;
        if (typeof TextDecoder !== "undefined") {
          const bytes = new Uint8Array(binLength);
          for (let i=0; i<binLength; i++) bytes[i] = bin.charCodeAt(i);
          return new TextDecoder("utf-8").decode(bytes);
        }
        // Fallback UTF-8 decode
        let esc = "";
        for (let i=0; i<binLength; i++) {
          const h = bin.charCodeAt(i).toString(16).padStart(2, "0");
          esc += `%${h}`;
        }
        return decodeURIComponent(esc);
      } else {
        // Node.js
        const buf = (globalThis as any).Buffer
          ? (globalThis as any).Buffer.from(payload, "base64")
          : require("buffer").Buffer.from(payload, "base64");
        return buf.toString("utf-8");
      }
    } else {
      // Percent-encoded (or plain) UTF-8
      try {
        return decodeURIComponent(payload);
      } catch {
        return payload;
      }
    }
  } catch {
    return null;
  }
}

export function normalizePackInput(input: IconPackInput | IconPack): IconPack {
  const icons: Record<IconGlyphKey, IconGlyph> = {};
  for (const [k, v] of Object.entries(input.icons)) {
    icons[k] = normalizeGlyphInput(v);
  }

  const meta: IconPackMeta = {
    label: input.meta?.label ?? "Unnamed",
    version: input.meta?.version ?? "1.0.0",
    license: input.meta?.license ?? "MIT",
    defaultViewBox: "0 0 24 24",
    extends: input.meta?.extends ?? [],
  };

  // always extend base if not already extending something and not base itself.
  if (!meta.extends.includes('base')) {
    meta.extends.push('base');
  }

  const pack: IconPack = { meta, icons };

  // normalize & attach overrides (if present) onto the pack (private field)
  const rawOverrides = (input as any).overrides as
    | Record<string, Record<IconGlyphKey, IconGlyphInput>>
    | undefined;

  if (rawOverrides) {
    const normalized: Record<string, Record<IconGlyphKey, IconGlyph>> = {};
    for (const [targetPackKey, rec] of Object.entries(rawOverrides)) {
      const mapped: Record<IconGlyphKey, IconGlyph> = {};
      for (const [gk, gv] of Object.entries(rec)) {
        mapped[gk] = normalizeGlyphInput(gv);
      }
      normalized[targetPackKey] = mapped;
    }
    (pack as any).__overrides = normalized;
  }

  return pack;
}