import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Workbook, AddressUtils, type IWorkbook, type IRangeSelection } from '@sheetxl/sdk';

import { type RangeCoords } from '@sheetxl/utils';

import {
  WorkbookElement,
  ReferenceModeProvider, createReferenceModeStore, useReferenceMode,
  handleReferencePointNav, isReferencePointSeeding,
  type IReferenceInputHandle, type ReferenceDoneArgs
} from '@sheetxl/react';

import { asStory } from '../../components';

/** Serialize a picked range ALWAYS sheet-qualified — a widget outside the workbook has no home sheet. */
const scopedText = (workbook: IWorkbook, r: RangeCoords): string | null => {
  if (!r) return null;
  try {
    const sheet = r.scope ? workbook.getWorksheet(r.scope) : workbook.getSelectedWorksheet();
    if (!sheet) return null;
    const bare = sheet.getRange({ rowStart: r.rowStart, colStart: r.colStart, rowEnd: r.rowEnd, colEnd: r.colEnd }).toString();
    return AddressUtils.sheetAndRangeToString(AddressUtils.sheetNameToString(sheet.getName()) ?? '', bare);
  } catch { return null; }
};

/**
 * A **client-authored** reference picker — deliberately NOT `ReferenceInput`: the point of this story
 * is that a third party can build one from the public bus primitives alone, with no Studio involvement.
 *
 * The pick is TOGGLE-driven: the button (or focusing the input and toggling) makes this widget the
 * reference-mode PRODUCER on whatever bus encloses it (here: the story's custom
 * `ReferenceModeProvider`). While picking, grid drags, header picks, sheet-tab switches and arrow keys
 * — from the grid OR from this input — write scoped ranges into the text. **Enter commits** (back to
 * idle, text kept) and **Escape cancels** (back to idle, text cleared), whether pressed on the grid
 * (they come home through the producer-supplied `onDone` — focus returns to THIS widget, never the
 * sheet) or in the input itself. Clicking the toggle while picking also commits.
 */
const ThirdPartyPicker: React.FC<{ workbook: IWorkbook }> = ({ workbook }) => {
  const referenceMode = useReferenceMode(); // resolves the story's provider, not the app default
  const [text, setText] = useState('');
  const [live, setLive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<IRangeSelection | null>(null);
  // The text as it was when picking STARTED — Escape reverts to it (cancel restores, not clears).
  const beforePickRef = useRef<string>('');

  const handleRef = useRef<IReferenceInputHandle | null>(null);
  if (!handleRef.current) {
    handleRef.current = {
      insertText: () => { /* not used by this widget */ },
      selectAll: () => inputRef.current?.select(),
      setSelection: (s) => inputRef.current?.setSelectionRange(s.start, s.end),
      focus: () => inputRef.current?.focus(),
      toggleReferences: () => { /* F4 — not used by this widget */ }
    };
  }

  /** Back to idle. `commit` keeps the text (the picked value IS the result); cancel REVERTS to the
   *  text as it was before picking started. */
  const stop = (commit: boolean): void => {
    const sel = selectionRef.current;
    selectionRef.current = null;
    setLive(false);
    if (!commit) setText(beforePickRef.current);
    referenceMode.setMode((prev) => (prev && prev.selection === sel ? null : prev));
    inputRef.current?.focus(); // done comes home to the WIDGET, never the sheet
  };

  const start = (): void => {
    if (selectionRef.current) return;
    beforePickRef.current = text;
    const displayed = workbook.getSelectedWorksheet();
    const selection = displayed!.getSelection().createSelection({ shapePolicy: 'ranges', navigationPolicy: 'modify' });
    // Seed the pick at the grid's CURRENT active cell (scoped) — the first arrow navigates from where
    // the user actually is, not from A1 (a fresh temporary's default anchor).
    selection.updateCoords({
      cell: { ...displayed!.getSelection().getCoords().cell, scope: displayed!.getName() },
      ranges: [],
      rangeIndex: -1
    });
    selectionRef.current = selection;
    setLive(true);
    referenceMode.setMode({
      mode: 'point',
      selection,
      activeInput: handleRef.current,
      // Enter/Tab on the GRID = commit → idle; Escape on the grid = cancel → idle.
      onDone: (args: ReferenceDoneArgs): void => { stop(args.reason === 'accept'); }
    });
    inputRef.current?.focus();
  };

  // Picker write-back: any pick (drag / header / keyboard) rewrites this input's text, always scoped.
  useEffect(() => {
    if (!live) return undefined;
    const sel = selectionRef.current;
    if (!sel) return undefined;
    return sel.addListeners({
      onChange: (): void => {
        if (isReferencePointSeeding()) return; // a keyboard seed positions the pick; the move reports
        const coords = sel.getCoords();
        const parts = (coords.ranges ?? [])
          .map((r) => scopedText(workbook, r))
          .filter(Boolean) as string[];
        setText(parts.join(', '));
      }
    });
  }, [live, workbook]);

  useEffect(() => () => stop(true), []); // release the bus on unmount

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', border: '1px solid #888', borderRadius: 6 }}>
      <span style={{ fontFamily: 'sans-serif', fontSize: 13 }}>My widget:</span>
      <input
        ref={inputRef}
        value={text}
        placeholder="Click Pick, then drag / arrow on the grid…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // While picking: arrows pick on the workbook's DISPLAYED sheet via the shared keymap; the
          // same Enter/Escape contract as on the grid applies in the input itself.
          if (live) {
            if (handleReferencePointNav(e, referenceMode.getMode(), workbook.getWorksheet().getName())) return;
            if (e.key === 'Enter') { e.preventDefault(); stop(true); return; }
            if (e.key === 'Escape') { e.preventDefault(); stop(false); return; }
          }
        }}
        style={{ flex: 1, padding: '4px 6px', fontFamily: 'monospace' }}
      />
      <button
        onClick={() => (live ? stop(true) : start())}
        style={{
          fontFamily: 'sans-serif', fontSize: 12, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
          border: `1px solid ${live ? '#2e7d32' : '#888'}`,
          background: live ? '#e8f5e9' : 'transparent',
          color: live ? '#2e7d32' : 'inherit'
        }}
      >
        {live ? 'picking… (click to commit)' : 'Pick'}
      </button>
    </div>
  );
};

const seedWorkbook = (): IWorkbook => {
  const wb = new Workbook();
  wb.addWorksheet('Sheet2');
  const s = wb.getWorksheetAt(0);
  s.getRange('A1:B1').setValues([['Pick', 'me']]);
  s.getRange('B3').setValue(42);
  return wb;
};

/**
 * The case-B acceptance test (REFERENCE-INPUT.md): a picker OUTSIDE Studio/Workbook, on a custom shared
 * `ReferenceModeProvider` wrapping widget + workbook. Everything inside the provider — the reference
 * layers, header layers, keyboard — shares the STORY's bus, isolated from the app default.
 */
const ThirdPartyTemplate: React.FC = () => {
  const workbook = useMemo(seedWorkbook, []);
  const store = useMemo(() => createReferenceModeStore(), []);
  return (
    <ReferenceModeProvider store={store}>
      <div className="storybook-container" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
        <ThirdPartyPicker workbook={workbook} />
        <div style={{ flex: '1 1 100%', minHeight: 0 }}>
          <WorkbookElement workbook={workbook} />
        </div>
      </div>
    </ReferenceModeProvider>
  );
};

export const ThirdPartyPickerStory = asStory(ThirdPartyTemplate);
ThirdPartyPickerStory.storyName = 'Third-party picker (custom provider)';

const Story = {
  title: 'Editor/Reference Picking (Third-party)',
  component: ThirdPartyPickerStory
};
export default Story;
