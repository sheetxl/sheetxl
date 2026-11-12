import React, { useMemo, useState } from 'react';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookElement, type ExplicitTokens, type ExplicitSurface } from '@sheetxl/react';
import { type TokenTheme, type ThemeMode } from '@sheetxl/utils-react';

import { asStory } from '../../components';

/**
 * **Theme playground.** A chromeless `<WorkbookElement>` on a page you color, with a field for every token
 * that paints the grid, per mode and surface. Whatever you set is applied live through the `tokens` prop,
 * and shown as the equivalent stylesheet: the two are the same rules, so copy whichever form you use.
 *
 * - An `app` value reaches the grid and headers too, in that mode. Set a `grid` or `header` value to make
 *   that surface differ.
 * - A value set for one mode never applies in the other.
 * - Leave a field empty to keep the default.
 */

type Field = { token: keyof TokenTheme; label: string };

/** The tokens that paint a chromeless workbook, by the surface they are usually set on. */
const FIELDS: Record<ExplicitSurface, Field[]> = {
  app: [
    { token: 'color-base-100', label: 'paper' },
    { token: 'color-base-200', label: 'backdrop around the grid' },
    { token: 'color-base-content', label: 'text' },
    { token: 'color-base-border', label: 'grid frame and header seam' },
    { token: 'color-primary', label: 'selection' }
  ],
  grid: [
    { token: 'color-base-100', label: 'cell paper' },
    { token: 'color-base-300', label: 'gridlines' }
  ],
  header: [
    { token: 'color-base-100', label: 'header paper' },
    { token: 'color-base-300', label: 'header dividers' },
    { token: 'color-base-hover', label: 'header hover' }
  ]
};

const SURFACES: ExplicitSurface[] = ['app', 'grid', 'header'];
const MODES: ThemeMode[] = ['light', 'dark'];

interface Preset {
  name: string;
  /** The page the workbook sits on, per mode. Not a token: it stands in for the host page. */
  page: Record<ThemeMode, string>;
  tokens: ExplicitTokens;
}

const PRESETS: Preset[] = [
  { name: 'Defaults', page: { light: '#ffffff', dark: '#121212' }, tokens: {} },
  {
    name: 'Navy card',
    page: { light: '#ffffff', dark: '#14102c' },
    tokens: {
      light: {
        app: {
          'color-base-100': '#ffffff', 'color-base-200': '#ffffff', 'color-base-300': '#ececf2',
          'color-base-border': 'rgba(8, 3, 33, 0.1)', 'color-base-content': '#080321', 'color-primary': '#3e7dff'
        },
        header: { 'color-base-100': '#f7f7fb', 'color-base-300': '#dcdce6', 'color-base-hover': 'rgba(8, 3, 33, 0.05)' }
      },
      dark: {
        app: {
          'color-base-100': '#14102c', 'color-base-200': '#14102c', 'color-base-300': '#29234a',
          'color-base-border': 'rgba(255, 255, 255, 0.1)', 'color-base-content': 'rgba(255, 255, 255, 0.87)',
          'color-primary': '#6e9bff'
        },
        header: { 'color-base-100': '#1a1538', 'color-base-300': '#312b55', 'color-base-hover': 'rgba(255, 255, 255, 0.06)' }
      }
    }
  },
  {
    name: 'Flat editor',
    page: { light: '#f8f8f8', dark: '#181818' },
    tokens: {
      light: {
        app: { 'color-base-200': '#f8f8f8', 'color-base-border': '#e5e5e5', 'color-primary': '#005fb8' },
        grid: { 'color-base-300': '#ececec' },
        header: { 'color-base-100': '#f8f8f8', 'color-base-300': '#e5e5e5' }
      },
      dark: {
        app: {
          'color-base-100': '#1f1f1f', 'color-base-200': '#181818', 'color-base-border': '#2b2b2b',
          'color-base-content': '#cccccc', 'color-primary': '#0078d4'
        },
        grid: { 'color-base-100': '#1f1f1f', 'color-base-300': '#2b2b2b' },
        header: { 'color-base-100': '#181818', 'color-base-300': '#2b2b2b' }
      }
    }
  }
];

/** Drop empty values and empty cells, so the output shows only what was set. */
const prune = (tokens: ExplicitTokens): ExplicitTokens => {
  const out: ExplicitTokens = {};
  for (const mode of MODES) {
    for (const surface of SURFACES) {
      const cell = Object.entries(tokens[mode]?.[surface] ?? {}).filter(([, v]) => typeof v === 'string' && v.trim());
      if (!cell.length) continue;
      ((out[mode] ??= {})[surface] = Object.fromEntries(cell));
    }
  }
  return out;
};

/** The same rules as the `tokens` prop, as a stylesheet a host can ship. */
const toCSS = (tokens: ExplicitTokens): string => {
  const blocks: string[] = [];
  for (const mode of MODES) {
    for (const surface of SURFACES) {
      const cell = tokens[mode]?.[surface];
      if (!cell) continue;
      const selector = surface === 'app'
        ? `[data-sxl-theme-mode="${mode}"]`
        : `[data-sxl-theme-mode="${mode}"][data-sxl-theme-surface="${surface}"]`;
      const decls = Object.entries(cell).map(([k, v]) => `    --sxl-${k}: ${v};`).join('\n');
      blocks.push(`  ${selector} {\n${decls}\n  }`);
    }
  }
  return blocks.length ? `@layer sxl-overrides {\n${blocks.join('\n')}\n}\n` : '/* nothing set: every token keeps its default */\n';
};

/** The same values as JSX for the `tokens` prop. */
const toJSX = (tokens: ExplicitTokens, mode: ThemeMode, darkGrid: boolean): string => {
  const body = JSON.stringify(tokens, null, 2).replace(/\n/g, '\n  ');
  const gridScheme = darkGrid ? mode : 'light';
  return `<WorkbookElement\n  colorScheme="${mode}"\n  gridColorScheme="${gridScheme}"\n  tokens={${body}}\n/>\n`;
};

const createSample = (): IWorkbook => {
  const wb = new Workbook();
  const sheet = wb.getWorksheetAt(0);
  sheet.getRange('A1:D1').setValues([['Plan', 'Seats', 'Price', 'Revenue']]);
  sheet.getRange('A2:C5').setValues([
    ['Starter', 120, 9],
    ['Team', 64, 29],
    ['Business', 18, 79],
    ['Enterprise', 4, 499]
  ]);
  sheet.getRange('D2:D5').setValues([['=B2*C2'], ['=B3*C3'], ['=B4*C4'], ['=B5*C5']]);
  sheet.getRange('A7:D7').setValues([['Total', '=SUM(B2:B5)', '', '=SUM(D2:D5)']]);
  sheet.getRange('C2:D7').setNumberFormat('$#,##0');
  return wb;
};

const panelText: React.CSSProperties = { font: '12px/1.4 system-ui, sans-serif', color: '#1f1f1f' };
const button = (active: boolean): React.CSSProperties => ({
  ...panelText, padding: '3px 10px', border: '1px solid #c8c8c8', borderRadius: 4, cursor: 'pointer',
  background: active ? '#1f1f1f' : '#ffffff', color: active ? '#ffffff' : '#1f1f1f'
});

const ColorField: React.FC<{ label: string; token: string; value: string; onChange: (v: string) => void }> = (props) => {
  const { label, token, value, onChange } = props;
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <label style={{ ...panelText, display: 'grid', gridTemplateColumns: '28px 1fr', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={isHex ? value : '#808080'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 22, padding: 0, border: '1px solid #c8c8c8', opacity: value ? 1 : 0.35 }}
      />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{label} <code style={{ color: '#6b6b6b' }}>{token}</code></span>
        <input
          type="text"
          value={value}
          placeholder="default"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...panelText, padding: '2px 4px', border: '1px solid #c8c8c8', borderRadius: 3 }}
        />
      </span>
    </label>
  );
};

const Template: React.FC = () => {
  const workbook = useMemo(createSample, []);
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [darkGrid, setDarkGrid] = useState(true);
  const [presetIndex, setPresetIndex] = useState(1);
  const [tokens, setTokens] = useState<ExplicitTokens>(PRESETS[1].tokens);
  const [page, setPage] = useState<Record<ThemeMode, string>>(PRESETS[1].page);
  const [output, setOutput] = useState<'css' | 'jsx'>('css');

  const applied = useMemo(() => prune(tokens), [tokens]);
  const code = output === 'css' ? toCSS(applied) : toJSX(applied, mode, darkGrid);

  const setToken = (surface: ExplicitSurface, token: keyof TokenTheme, value: string): void => {
    setTokens((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [surface]: { ...prev[mode]?.[surface], [token]: value } }
    }));
  };

  const loadPreset = (index: number): void => {
    setPresetIndex(index);
    setTokens(PRESETS[index].tokens);
    setPage(PRESETS[index].page);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', height: '100%', ...panelText }}>
      <div style={{ background: page[mode], padding: 32, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
          <WorkbookElement
            workbook={workbook}
            showTabs={false}
            colorScheme={mode}
            gridColorScheme={darkGrid ? mode : 'light'}
            tokens={applied}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      <div style={{ background: '#fafafa', borderLeft: '1px solid #e0e0e0', padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map((p, i) => (
            <button key={p.name} style={button(i === presetIndex)} onClick={() => loadPreset(i)}>{p.name}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {MODES.map((m) => (
            <button key={m} style={button(m === mode)} onClick={() => setMode(m)}>{m}</button>
          ))}
          <label style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={darkGrid} onChange={(e) => setDarkGrid(e.target.checked)} />
            grid follows dark
          </label>
        </div>

        <ColorField
          label="page"
          token="(the host page, not a token)"
          value={page[mode]}
          onChange={(v) => setPage((prev) => ({ ...prev, [mode]: v }))}
        />

        {SURFACES.map((surface) => (
          <fieldset key={surface} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend style={{ padding: '0 4px', fontWeight: 600 }}>{mode} · {surface}</legend>
            {FIELDS[surface].map(({ token, label }) => (
              <ColorField
                key={token}
                label={label}
                token={token}
                value={(tokens[mode]?.[surface]?.[token] as string) ?? ''}
                onChange={(v) => setToken(surface, token, v)}
              />
            ))}
          </fieldset>
        ))}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={button(output === 'css')} onClick={() => setOutput('css')}>CSS</button>
          <button style={button(output === 'jsx')} onClick={() => setOutput('jsx')}>tokens prop</button>
          <button style={{ ...button(false), marginLeft: 'auto' }} onClick={() => navigator.clipboard?.writeText(code)}>copy</button>
        </div>
        <pre style={{ margin: 0, padding: 8, background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {code}
        </pre>
      </div>
    </div>
  );
};

export const Playground = asStory(Template);
Playground.args = {};
Playground.storyName = 'Playground';

const Story = {
  title: 'Theming',
  component: WorkbookElement,
  parameters: { layout: 'fullscreen' }
};
export default Story;
