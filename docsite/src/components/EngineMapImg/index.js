/**
 * "One engine, many surfaces": everything in SheetXL plugs into the same headless engine.
 * Drawn inline (not an asset) so it takes the site's theme colors in light and dark.
 */
const box = {
  fill: 'var(--ifm-background-surface-color)',
  stroke: 'var(--ifm-color-primary)',
  strokeWidth: 1.5,
};
const title = {
  fill: 'var(--ifm-font-color-base)',
  fontSize: 15,
  fontWeight: 600,
  textAnchor: 'middle',
};
const detail = {
  fill: 'var(--ifm-color-emphasis-700)',
  fontSize: 12,
  textAnchor: 'middle',
};
const pkg = {
  ...detail,
  fontFamily: 'var(--ifm-font-family-monospace)',
  fontSize: 11,
};
const wire = {
  stroke: 'var(--ifm-color-primary)',
  strokeWidth: 2,
  fill: 'none',
  markerEnd: 'url(#sxl-engine-map-arrow)',
};

function Surface({ x, y, w, h, name, about, packages }) {
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} style={box} />
      <text x={cx} y={y + 24} style={title}>{name}</text>
      <text x={cx} y={y + 43} style={detail}>{about}</text>
      <text x={cx} y={y + 61} style={pkg}>{packages}</text>
    </g>
  );
}

export default function EngineMapImg({ style, alt }) {
  return (
    <svg viewBox="0 0 760 420" role="img" aria-label={alt} style={{ fontFamily: 'var(--ifm-font-family-base)', ...style }}>
      <defs>
        <marker id="sxl-engine-map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--ifm-color-primary)' }} />
        </marker>
      </defs>

      <Surface x={50} y={10} w={320} h={74} name="AI agents"
        about="A real engine as agent tools" packages="mcp · skills" />
      <Surface x={390} y={10} w={320} h={74} name="Your app"
        about="Studio, a vanilla page, or your own React UI" packages="studio-mui · studio-vanilla · react · grid-react" />

      <Surface x={10} y={124} w={220} h={74} name="Scripting"
        about="Macros and custom functions" packages="scripting · scripting-mui" />
      <Surface x={10} y={238} w={220} h={74} name="Command line"
        about="One-liners and runner scripts" packages="sheetxl · runner" />

      <Surface x={530} y={124} w={220} h={74} name="Files"
        about="xlsx, csv, json, and sxl" packages="io · io-xlsx" />
      <Surface x={530} y={238} w={220} h={74} name="Databases"
        about="Live data through the API" packages="db.query" />

      <g>
        <rect x={270} y={130} width={220} height={176} rx={12} style={{ fill: 'var(--ifm-color-primary-darkest)' }} />
        <text x={380} y={186} style={{ ...title, fill: '#fff', fontSize: 20 }}>One engine</text>
        <text x={380} y={210} style={{ ...detail, fill: '#fff', opacity: 0.9, fontSize: 13 }}>Workbooks, calculation, ranges</text>
        <text x={380} y={238} style={{ ...pkg, fill: '#fff', opacity: 0.9, fontSize: 12 }}>sdk</text>
        <text x={380} y={256} style={{ ...pkg, fill: '#fff', opacity: 0.9, fontSize: 12 }}>formulas</text>
        <text x={380} y={274} style={{ ...pkg, fill: '#fff', opacity: 0.9, fontSize: 12 }}>primitives</text>
      </g>

      <path d="M 250 84 L 320 128" style={wire} />
      <path d="M 510 84 L 440 128" style={wire} />
      <path d="M 230 161 L 268 175" style={wire} />
      <path d="M 230 275 L 268 261" style={wire} />
      <path d="M 530 161 L 492 175" style={wire} />
      <path d="M 530 275 L 492 261" style={wire} />

      <rect x={10} y={346} width={740} height={60} rx={10} style={{ fill: 'var(--ifm-color-emphasis-200)' }} />
      <text x={380} y={372} style={{ ...title, fontSize: 14 }}>Runs anywhere JavaScript runs</text>
      <text x={380} y={392} style={detail}>browser · Node · Web Worker</text>
      <path d="M 380 306 L 380 344" style={{ ...wire, markerEnd: 'none', strokeDasharray: '4 4' }} />
    </svg>
  );
}
