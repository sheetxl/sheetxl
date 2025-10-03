
export type IconPackKey = string;               // 'base' | 'material' | 'thin' | 'excel' | ...
export type IconGlyphKey = string;               // 'copy', 'bold', 'ai.summarize'

export type IconPath = {
  d: string;
  className?: string
  fill?: string;          // default "currentColor"
  stroke?: string;        // default "currentColor" (if your set is stroke-based)
  opacity?: number | string;
  fillRule?: "nonzero" | "evenodd";
  clipRule?: "nonzero" | "evenodd";
};

type BaseGlyph = {
  tags?: string[];
  rtlMirror?: boolean; // or key to re
};

export type SvgRender = (props: React.HTMLAttributes<SVGElement>) => React.ReactNode;
export type SvgDef = {
  paths: IconPath[];
  viewBox?: string;
};

export type SvgSource = SvgDef | SvgRender;

// Keyed union — exactly one of these keys must exist:
export type SvgGlyph   = BaseGlyph & { svg:   SvgSource } ;
export type UrlGlyph   = BaseGlyph & { url:   { src: string } };
export type EmojiGlyph = BaseGlyph & { emoji: string | { text: string } };

export type ReactGlyph<P extends ReactIconProps = ReactIconProps> =
  BaseGlyph & { react: ReactInput<P> };

export type IconGlyph = SvgGlyph | UrlGlyph | EmojiGlyph | ReactGlyph;

export interface IconPackMeta {
  label: string;
  version: string;
  license: string;

  defaultViewBox: string;     // fallback for SVGs missing viewBox
  // extends allows for multiple extends
  extends: IconPackKey[];
}

export interface IconPack {
  icons: Readonly<Record<IconGlyphKey, IconGlyph>>;
  meta: IconPackMeta;
}

export interface IconGlyphPackPair {
  glyph: IconGlyph;
  pack: IconPack;
  packKey: string;
}

export interface ReactIconProps extends React.HTMLAttributes<HTMLElement> {};

export type SvgSourceInput = (SvgDef & BaseGlyph) | SvgRender | IconPath[] | string[] | string;
export type UrlInput = { src: string } | string;
export type EmojiInput = { text: string } | string;
export type ReactInput<P extends ReactIconProps=ReactIconProps> = (props: P) => React.ReactNode;

export type IconGlyphInput =
  | ({ svg: SvgSourceInput })
  | ({ url: UrlInput } & BaseGlyph)
  | ({ emoji: EmojiInput } & BaseGlyph)
  | ({ react: ReactInput } & BaseGlyph);
// TODO - add redirect: string which does another lookup


export type IconsInputRecord = Readonly<Record<IconGlyphKey, IconGlyphInput>>;
export interface IconPackInput {
  icons: IconsInputRecord;
  meta?: Partial<IconPackMeta>;
  overrides?: Record<IconPackKey, IconsInputRecord>;
}
