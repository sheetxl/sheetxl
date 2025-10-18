import React, { memo, useMemo } from 'react';

import { CommonUtils } from '@sheetxl/utils';

import { DefaultDynamicIconService } from './DynamicIconService';
import type {
  IconGlyphKey, IconPath, IconPackKey, IconGlyphPackPair, SvgGlyph
} from './Types';

import { ErrorIcon } from './ErrorIcon';

import styles from './DynamicIcon.module.css';

export interface DynamicIconProps extends React.HTMLAttributes<HTMLElement> {
  iconKey?: IconGlyphKey;
  packKey?: IconPackKey;

  className?: string;
  style?: React.CSSProperties;

  /** Sets wrapper font-size; children scale to 1em */
  size?: string | number;
  title?: string;

  role?: 'img' | 'presentation' | string;
  ariaHidden?: boolean;

  /** Extra props forwarded to React glyphs (if the glyph is of type `react`) */
  propsSource?: unknown;
}

export const DynamicIcon = memo((props: DynamicIconProps) => {
  const {
    iconKey: propGlyphKey,
    packKey: propPackKey,
    className: propClassName,
    style: propStyle,
    role: propRole,
    title,
    size,
    ariaHidden: propAriaHidden,
    propsSource,
    children,
    ...rest
  } = props;

  const [pair, setPair] = React.useState<IconGlyphPackPair | null>(null);

  // Resolve glyph (namespaced "pack:key" or local)
  React.useEffect(() => {
    let alive = true;
    let resolvedPackKey = propPackKey;
    let resolveGlyphKey = propGlyphKey;

    if (!resolveGlyphKey) {
      // render an empty wrapper that still carries sizing from pack (if available)
      const packBlank = DefaultDynamicIconService.getPack(resolvedPackKey);
      setPair({
        glyph: packBlank ? ({ svg: CommonUtils.EmptyArray } as SvgGlyph) : undefined,
        pack: packBlank ?? undefined,
        packKey: resolvedPackKey ?? DefaultDynamicIconService.getActive()
      });
      return;
    }

    if (resolveGlyphKey.includes(':')) {
      const [nsPack, keyOnly] = resolveGlyphKey.split(':');
      resolvedPackKey = nsPack as IconPackKey;
      resolveGlyphKey = keyOnly as IconGlyphKey;
    }

    DefaultDynamicIconService
      .resolve(resolveGlyphKey, { packKey: resolvedPackKey })
      .then(r => { if (alive) setPair(r); });

    return () => { alive = false; };
  }, [propGlyphKey, propPackKey]);

  const pack    = pair?.pack;
  const glyph   = pair?.glyph;
  const packKey = pair?.packKey;

  // Unpack glyph sources
  let asSVG = glyph ? (glyph as any)['svg'] : undefined;
  const asUrl = glyph && !asSVG ? (glyph as any)['url'] : undefined;
  const asEmoji = glyph && !asSVG && !asUrl ? (glyph as any)['emoji'] : undefined;

  // Compute wrapper font-size
  const fontSize = size != null ? (typeof size === 'number' ? `${size}px` : size) : undefined;

  // Wrapper className (module + user)
  const wrapperClassName = useMemo(() => {
    const list = [styles.Icon, 'icon', propClassName].filter(Boolean);
    return list.join(' ');
  }, [propClassName]);

  // Wrapper style: expose --icon-size and merge user style
  const wrapperStyle = useMemo<React.CSSProperties>(() => {
    const s: React.CSSProperties = { ...propStyle };
    (s as any)['--icon-size'] = fontSize;
    // optional: filters/variables also live here so children inherit
    return s;
  }, [propStyle, fontSize]);

  // ARIA on wrapper
  const role = propRole ?? (title ? 'img' : 'presentation');
  const ariaHidden = propAriaHidden ?? (title ? undefined : true);

  // Unified wrapper
  const wrap = (child: React.ReactNode) => (
    <span
      className={wrapperClassName}
      style={wrapperStyle}
      role={role}
      aria-hidden={ariaHidden}
      title={title}
      data-icon-glyph={propGlyphKey}
      data-icon-pack={packKey}
      {...rest}
    >
      {child}
    </span>
  );

  // wraps a child
  if (children) {
    return wrap(children);
  }

  // Emoji
  if (asEmoji) {
    return wrap(<span>{typeof asEmoji === 'string' ? asEmoji : asEmoji.text}</span>);
  }

  // URL image
  if (asUrl) {
    return wrap(
      <img
        src={asUrl.src}
        alt={title ?? ''}
      />
    );
  }

  // React glyph (custom renderer)
  if (glyph && 'react' in glyph) {
    const C = (glyph as any).react as React.ComponentType<any>;
    // We still pass className/style to child for backwards-compat (animations etc.)
    const passProps = {
      className: wrapperClassName,
      style: wrapperStyle,
      role,
      'aria-hidden': ariaHidden,
      title,
      ...rest,
      ...(propsSource as any)
    };
    return wrap(<C {...passProps} />);
  }

  // SVG glyph
  const commonSvgProps = {
    viewBox: asSVG?.viewBox ?? pack?.meta.defaultViewBox ?? '0 0 24 24',
    // width/height controlled by CSS: .Icon > svg { width:1em; height:1em; }
  } as React.SVGProps<SVGSVGElement>;

  if (typeof asSVG === 'function') {
    const node = asSVG(commonSvgProps);
    return wrap(node ?? <ErrorIcon {...commonSvgProps} />);
  }

  if (!asSVG) {
    return wrap(<ErrorIcon {...commonSvgProps} />);
  }

  const paths = asSVG.paths;
  return wrap(
    <svg {...commonSvgProps}>
      {paths
        ? paths.map((p: IconPath, i: number) => (
            <path
              key={i}
              d={p.d}
              className={p.className}
              fill={p.fill}
              stroke={p.stroke}
              opacity={p.opacity}
              fillRule={p.fillRule}
              clipRule={p.clipRule}
            />
          ))
        : null}
    </svg>
  );
});
