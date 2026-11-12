import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Workbook, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import {
  addRangeAnnotations, getRangeAnnotationState, type PresenceHost, type PresenceHostEvent, type PresenceIntent,
  type PresencePromptAnswer, type PresenceUserEvent
} from '@sheetxl/react';

import { PresencePlugin, Studio, type PresencePluginInstance } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/**
 * A {@link PresenceHost} that runs in the page: the story pushes what an agent would, and collects
 * what the user does back. A real host relays the same events from an agent's tool calls.
 */
class InProcessHost implements PresenceHost {
  private readonly _listeners = new Set<(event: PresenceHostEvent) => void>();
  private readonly _notices = new Set<(event: PresenceUserEvent) => void>();

  subscribe(listener: (event: PresenceHostEvent) => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  answerPrompt(_promptId: string, _answer: PresencePromptAnswer): void {
    // This host never asks: agent clients ask in their own chat.
  }

  notify(event: PresenceUserEvent): void {
    for (const listener of [...this._notices]) listener(event);
  }

  /** Hear what the user dismissed. */
  onNotice(listener: (event: PresenceUserEvent) => void): () => void {
    this._notices.add(listener);
    return () => { this._notices.delete(listener); };
  }

  emit(event: PresenceHostEvent): void {
    for (const listener of [...this._listeners]) listener(event);
  }

  highlight(sessionId: string, intent: PresenceIntent, ranges: { range: string; label?: string }[]): void {
    this.emit({ type: 'highlight', sessionId, intent, ranges });
  }

  pulse(label: string, meter: number): void {
    this.emit({ type: 'status', connected: true, activity: { label }, meter });
  }
}

const seed = (sheet: IWorksheet): void => {
  sheet.getRange('B2:D2').setValues([['Region', 'Units', 'Revenue']]);
  sheet.getRange('B3:D6').setValues([
    ['North', 120, 14.4], ['South', 95, 11400], ['East', 143, 17160], ['West', 88, 10560]
  ]);
  sheet.getRange('F2:H2').setValues([['Month', 'Plan', 'Actual']]);
  sheet.getRange('F3:H8').setValues([
    ['Jan', 100, 98], ['Feb', 100, 104], ['Mar', 100, 87], ['Apr', 100, 112], ['May', 100, 99], ['Jun', 100, 0]
  ]);
};

const bar: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', font: '12px system-ui'
};
const btn: React.CSSProperties = { font: '12px system-ui', padding: '2px 8px' };

/**
 * The plugin, once for the page, as a host creates it at load: its registrations are global, so a
 * second instance would take them over from the first.
 */
const host = new InProcessHost();
const presence: PresencePluginInstance = PresencePlugin(host);

const Template: React.FC = () => {
  const source = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    seed(wb.getSelectedWorksheet()!);
    return wb;
  }, []);
  // The workbook Studio shows, as it reports it: the one the store binds and the agent addresses.
  const [workbook, setWorkbook] = useState<IWorkbook | null>(null);
  useEffect(() => {
    if (workbook) presence.store.bind(workbook);
  }, [workbook]);
  // For a script driving the story from outside: another writer's annotations, and the state.
  useEffect(() => {
    (window as unknown as { __sxlPresenceStory?: unknown }).__sxlPresenceStory = {
      workbook, host, addRangeAnnotations, getRangeAnnotationState
    };
  }, [workbook]);

  // What reached the host, newest first.
  const [notices, setNotices] = useState<string[]>([]);
  useEffect(() => host.onNotice((event: PresenceUserEvent) => {
    const text = event.type === 'finding.dismissed' ? `dismissed ${event.id}` : `dismissed all ${event.intent}s`;
    setNotices((list) => [text, ...list].slice(0, 6));
  }), []);

  const sessionId = workbook?.getId() ?? '';
  const q = (address: string): string => `'${workbook?.getSelectedWorksheet()?.getName()}'!${address}`;
  const refCalls = useRef(0);
  const [calls, setCalls] = useState(0);
  const call = (label: string): void => {
    refCalls.current++;
    host.pulse(label, refCalls.current);
    setCalls(refCalls.current);
  };

  const review = (): void => {
    call('highlighted');
    host.highlight(sessionId, 'finding', [
      { range: q('D3'), label: 'North revenue looks like it was typed in thousands.' },
      { range: q('H5'), label: 'March actual is 13% under plan.' },
      { range: q('H8'), label: 'June actual is 0: not reported yet?' }
    ]);
  };
  const question = (): void => {
    call('highlighted');
    host.highlight(sessionId, 'question', [{ range: q('B3:D6'), label: 'Is Revenue in dollars or thousands?' }]);
  };
  // The cursor walks down the plan column, a call a beat, as an agent writing would.
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    if (!walking) return undefined;
    let row = 3;
    const timer = setInterval(() => {
      call('ran script');
      host.highlight(sessionId, 'working', [{ range: q(`G${row}`), label: `Checking plan for row ${row}` }]);
      row = row >= 8 ? 3 : row + 1;
    }, 900);
    return () => clearInterval(timer);
  }, [walking]);

  // Connected on open, with a first walk to look at.
  useEffect(() => {
    if (!workbook) return;
    host.emit({ type: 'status', connected: true, meter: 0 });
    review();
  }, [workbook]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={bar}>
        <b>Agent (in-process):</b>
        <button style={btn} onClick={review}>raise findings</button>
        <button style={btn} onClick={question}>ask about a range</button>
        <button style={btn} onClick={() => setWalking((w) => !w)}>{walking ? 'stop' : 'start'} working cursor</button>
        <button style={btn} onClick={() => call('searched')}>status pulse</button>
        <button style={btn} onClick={() => host.emit({ type: 'status', connected: false })}>disconnect</button>
        <button style={btn} onClick={() => host.emit({ type: 'reset', sessionId })}>reset session</button>
        <span style={{ opacity: 0.7 }}>{calls} calls</span>
      </div>
      <div style={{ ...bar, paddingTop: 0, opacity: 0.8 }}>
        <b>Host heard:</b> {notices.length ? notices.join(' · ') : 'nothing yet (dismiss a finding from its tag or the Agent pane)'}
      </div>
      <Studio
        sx={{ flex: '1 1 100%', minHeight: 460 }}
        workbook={source}
        onWorkbookChange={setWorkbook}
        topRight={presence.strip}
        title="Presence"
      />
      {presence.overlay}
    </div>
  );
};

/**
 * **Presence — an agent working in the view, from any host.** `PresencePlugin(host)` registers the
 * findings layer, the `agent` task pane and its commands, and returns the strip for Studio's
 * `topRight`. The host here is in-process: the buttons push what an agent's tool calls would
 * (findings, a question, a moving `working` cursor, status), and the line under them shows what the
 * user's dismissals send back. Open **Anomalies** too: its outline and the agent's findings draw
 * side by side.
 */
export const Presence = asStory(Template);
Presence.storyName = 'Presence';

const Story = {
  title: 'Studio/Presence',
  component: Presence,
  parameters: { layout: 'fullscreen' }
};
export default Story;
