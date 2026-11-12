import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const { CommandScope, FocusActivation, CommandScopeContext, CommandAnchorProvider } = Command;

/**
 * **Two toolbars, one registry, BOTH focus-driven** — differing ONLY by the region each tracker is
 * attached to. This is the real-app scenario (a main toolbar + a script-editor toolbar), and it shows
 * that the script toolbar's "always active" behavior is NOT a pin — it's region-scoped focus that simply
 * never sees the sheet.
 *
 * Registry: `undo` on the app root (shared); `bold` on `sheet`; `save` on `scripting`.
 * - **Main** toolbar → {@link FocusActivation} attached to the **app root** (sees both regions), seeded
 *   at `sheet`.
 * - **Script** toolbar → a *separate* {@link FocusActivation} attached to the **scripting region only**,
 *   seeded at `scripting`.
 *
 * Focus the Sheet area → main **Bold** enabled. Focus the Scripting area → main **Bold disables** (sheet
 * isn't in the `scripting → root` chain). The Script toolbar's **Save** stays enabled either way: focus in
 * the sheet is *outside its region*, so `findScope` never matches and its anchor never leaves `scripting`.
 * **Undo** (root) is always enabled in both. Same class, two attach points — no pin.
 */
const Template: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scriptingRef = useRef<HTMLDivElement>(null);

  const { app, sheet, scripting, mainFocus, scriptFocus } = useMemo(() => {
    const app = new CommandScope('app');
    const sheet = app.createChild('sheet');
    const scripting = app.createChild('scripting');
    app.updateCommand('undo', { label: 'Undo', icon: '↶', callback: () => console.log('undo') });
    sheet.updateCommand('bold', { label: 'Bold', icon: 'B', callback: () => console.log('bold') });
    scripting.updateCommand('save', { label: 'Save', icon: '💾', callback: () => console.log('save') });
    // Each tracker's cold-start value is its ctor `initialAnchor` — so each toolbar resolves
    // correctly BEFORE anything is focused; real focus advances the anchors thereafter.
    return { app, sheet, scripting, mainFocus: new FocusActivation(null, sheet), scriptFocus: new FocusActivation(null, scripting) };
  }, []);

  // Live anchor indicators straight off each tracker.
  const [mainKey, setMainKey] = useState(() => mainFocus.getAnchor()?.key ?? '(none)');
  const [scriptKey, setScriptKey] = useState(() => scriptFocus.getAnchor()?.key ?? '(none)');
  useEffect(() => mainFocus.subscribe(() => setMainKey(mainFocus.getAnchor()?.key ?? '(none)')), [mainFocus]);
  useEffect(() => scriptFocus.subscribe(() => setScriptKey(scriptFocus.getAnchor()?.key ?? '(none)')), [scriptFocus]);

  // Main tracker: attached to the app root, so it sees focus in BOTH regions.
  useEffect(() => {
    if (!rootRef.current) return;
    const detach = mainFocus.attach(rootRef.current);
    const removers: Array<() => void> = [];
    if (sheetRef.current) removers.push(mainFocus.register(sheetRef.current, sheet));
    if (scriptingRef.current) removers.push(mainFocus.register(scriptingRef.current, scripting));
    return () => { detach(); removers.forEach((r) => r()); };
  }, [mainFocus, sheet, scripting]);

  // Script tracker: attached to the SCRIPTING region only — focus outside it never reaches this tracker.
  useEffect(() => {
    if (!scriptingRef.current) return;
    const detach = scriptFocus.attach(scriptingRef.current);
    const remove = scriptFocus.register(scriptingRef.current, scripting);
    return () => { detach(); remove(); };
  }, [scriptFocus, scripting]);

  const regionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 12,
    borderRadius: 4,
    outline: 'none',
    border: `2px solid ${active ? '#3b82f6' : '#ccc'}`,
    background: active ? '#eaf2ff' : '#fafafa'
  });

  return (
    <div ref={rootRef} style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h3>Two toolbars — both focus-driven, region-scoped</h3>

      {/* Main toolbar — its resolver follows focus across the whole app. */}
      <CommandScopeContext.Provider value={app}>
        <CommandAnchorProvider tracker={mainFocus} debounce={150}>
          <div style={rowStyle}>
            <strong style={{ width: 70 }}>Main</strong>
            <CommandButton commandKey="bold" />
            <CommandButton commandKey="undo" />
            <span style={{ color: '#888' }}>anchor: <b>{mainKey}</b></span>
          </div>
        </CommandAnchorProvider>
      </CommandScopeContext.Provider>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <div ref={sheetRef} tabIndex={0} style={regionStyle(mainKey === 'sheet')}>
          Sheet area — click to focus
        </div>

        {/* Scripting region contains its OWN toolbar, whose tracker is scoped to this region. */}
        <div ref={scriptingRef} tabIndex={0} style={regionStyle(mainKey === 'scripting')}>
          <CommandScopeContext.Provider value={scripting}>
            <CommandAnchorProvider tracker={scriptFocus} debounce={150}>
              <div style={rowStyle}>
                <strong style={{ width: 70 }}>Script</strong>
                <CommandButton commandKey="save" />
                <CommandButton commandKey="undo" />
                <span style={{ color: '#888' }}>anchor: <b>{scriptKey}</b></span>
              </div>
            </CommandAnchorProvider>
          </CommandScopeContext.Provider>
          <div style={{ marginTop: 8, color: '#555' }}>Scripting area — click to focus</div>
        </div>
      </div>

      <p style={{ color: '#888', maxWidth: 640, marginTop: 12 }}>
        Focus the <b>Sheet area</b> → main <b>Bold</b> enabled. Focus the <b>Scripting area</b> → main{' '}
        <b>Bold disables</b> (sheet isn't in the <code>scripting → root</code> chain). The <b>Script</b>{' '}
        toolbar's <b>Save</b> stays enabled either way — focus in the sheet is outside its region, so its
        anchor never leaves <code>scripting</code>. <b>Undo</b> (root) is always enabled in both. No pin —
        just region-scoped focus.
      </p>
    </div>
  );
};

export const TwoToolbarsFocus = asStory(Template);
TwoToolbarsFocus.storyName = 'Two Toolbars (Focus)';

const Story = { title: 'Commands' };
export default Story;
