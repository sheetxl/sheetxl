import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IFunction } from '@sheetxl/sdk';

import { getReferenceMode } from '@sheetxl/react';

import { FunctionArgumentsPanel } from '../function/FunctionArgumentsPanel';

/**
 * The argument form's two EVALUATIONS, over a real workbook: each argument on its own, and the
 * assembled call for the result line. The expansion itself is covered by the pure `toArgRows` tests
 * in `@sheetxl/react`; what needs a mount is the wiring between the fields and the engine.
 */
describe('FunctionArgumentsPanel (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  const mount = async (props: Record<string, unknown>): Promise<HTMLElement> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => { root.render(createElement(FunctionArgumentsPanel as never, props)); });
    return container;
  };

  /** Type into a field the way the browser does (React listens to the native `input` event). */
  const type = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Both evaluations are async — let the engine answer before reading the DOM back.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };

  const inputs = (container: HTMLElement): HTMLInputElement[] =>
    Array.from(container.querySelectorAll('input'));

  /** Each row's evaluated value (the text after its always-present `=`), in row order. */
  const argValues = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll('.function-arg-value')).map(el => el.textContent ?? '');

  it('evaluates each argument on its own, and the whole call for the result', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getSelectedWorksheet().getRange('A1:A3').setValues([[1], [2], [3]]);
    const sum = workbook.getCalculation().getFunctions().getByName('SUM') as IFunction;

    let call: string | null = null;
    const container = await mount({ func: sum, workbook, onChangeCall: (next: string) => { call = next; } });

    await type(inputs(container)[0], 'A1:A3');
    // The argument's own value, not a slice of the assembled call. The second row has no value yet
    // — but it still has its `=`, which is the row's shape rather than a decoration on the value.
    expect(argValues(container)).toEqual(['{1; 2; 3}', '']);
    expect(container.querySelector('.function-result')?.textContent).toBe('6');
    expect(call).toBe('=SUM(A1:A3)');

    // Filling the last row grows the form, and the result follows.
    await type(inputs(container)[1], '4');
    expect(inputs(container)).toHaveLength(3);
    expect(container.querySelector('.function-result')?.textContent).toBe('10');
    expect(call).toBe('=SUM(A1:A3,4)');
  }, 30_000);

  it('heads the page with the NAME (not the signature) and types its fields by placeholder', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sum = workbook.getCalculation().getFunctions().getByName('SUM') as IFunction;
    const container = await mount({ func: sum, workbook });
    // The descriptor (the summary under the name) is loaded lazily, as the editor's preview loads it.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    const text = container.textContent ?? '';
    expect(text).toContain('SUM');
    // The argument list is the FORM below — the page does not also say it in one line at the top.
    expect(text).not.toContain('SUM(');
    // The type is said in words, in the empty field, rather than as the hint's `{}` icon.
    expect(inputs(container)[0].placeholder).toBe('number');
  }, 30_000);

  it('arms POINT mode on the focused argument, so the grid can be picked into it', async () => {
    // The other half of picking is the dialog's `suspendModal` (it watches this same bus); what this
    // holds is that an argument field is a reference-mode PRODUCER at all — an empty one arms
    // outright, since the caret sits where an operand is expected.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sum = workbook.getCalculation().getFunctions().getByName('SUM') as IFunction;
    const container = await mount({ func: sum, workbook, home: { rowIndex: 4, colIndex: 1, scope: 'Sheet1' } });

    await act(async () => { inputs(container)[1].focus(); });
    expect(getReferenceMode()?.mode).toBe('point');
    // A formula argument may hold references to any number of sheets.
    expect(getReferenceMode()?.allowMulti).toBe(true);
    expect(getReferenceMode()?.activeInput).toBeTruthy();

    // ...and a TYPED reference publishes itself, which is what paints the range on the grid. An
    // argument is written bare (`A1:B2`, no `=`) — the projection has to read that as an expression,
    // exactly as the field's own value parse does.
    await type(inputs(container)[1], 'A1:B2');
    const ranges = getReferenceMode()?.selection.getCoords().ranges ?? [];
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({ rowStart: 0, colStart: 0, rowEnd: 1, colEnd: 1, scope: 'Sheet1' });
  }, 30_000);

  it('shows an argument\'s error where the result goes, named by its label', async () => {
    // Five reserved error lines is most of this panel's height, so the fields keep only their
    // outline and the message takes the result's line — where there is room for it, and where the
    // absence of a result is explained rather than silent.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sum = workbook.getCalculation().getFunctions().getByName('SUM') as IFunction;
    const container = await mount({ func: sum, workbook });

    await type(inputs(container)[0], '1)');
    const message = container.querySelector('.function-error')?.textContent ?? '';
    expect(message).toContain('number1');
    expect(container.querySelector('.function-result')).toBeNull();
    // The field itself still reads as wrong, it just does not repeat the sentence.
    expect(container.querySelector('.Mui-error')).toBeTruthy();

    // Fixed — the result line comes back.
    await type(inputs(container)[0], '1');
    expect(container.querySelector('.function-error')).toBeNull();
    expect(container.querySelector('.function-result')?.textContent).toBe('1');
  }, 30_000);

  it('holds the result line empty until every REQUIRED argument is filled', async () => {
    // The blank slots stay in the assembled call (`=ROUND(1.234,)` — trimming them would change its
    // arity), and that call evaluates perfectly well: a blank argument is zero. But the number that
    // comes back is an answer about a field the user has not reached yet, and against `Result` it
    // reads as the answer to the call they are building. Excel's dialog holds the line for the same
    // reason.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const round = workbook.getCalculation().getFunctions().getByName('ROUND') as IFunction;
    let call: string | null = null;
    const container = await mount({ func: round, workbook, onChangeCall: (next: string) => { call = next; } });

    await type(inputs(container)[0], '1.234');
    // The blank IS in the call (both of ROUND's parameters are required, so neither is trimmed) —
    // this is the empty result of a legal formula, not of a formula that failed to compile.
    expect(call).toBe('=ROUND(1.234,)');
    // The argument's OWN value still shows — that one is about the field it sits beside.
    expect(argValues(container)[0]).toBe('1.234');
    expect(container.querySelector('.function-result')?.textContent).toBe('');

    await type(inputs(container)[1], '2');
    expect(container.querySelector('.function-result')?.textContent).toBe('1.23');

    // ...and emptying it again takes the result back off, rather than leaving the last one standing.
    await type(inputs(container)[1], '');
    expect(container.querySelector('.function-result')?.textContent).toBe('');
  }, 30_000);

  it('keeps the OTHER arguments\' values while one is half-typed', async () => {
    // The reason each row evaluates its own formula: as a subtree of the assembled call, one
    // in-progress argument would fail the parse and blank every row at once — during the exact
    // activity this panel exists for.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sum = workbook.getCalculation().getFunctions().getByName('SUM') as IFunction;
    const container = await mount({ func: sum, workbook });

    await type(inputs(container)[0], '41');
    expect(argValues(container)[0]).toBe('41');
    await type(inputs(container)[1], 'A1:');
    // The half-typed argument shows no value of its own, and the other one keeps its answer. (The
    // form grew a third row: growth follows the TEXT, not whether it parses yet.)
    expect(argValues(container)).toEqual(['41', '', '']);
  }, 30_000);

  it('offers an enum argument\'s values while its field is empty — a field still, not a select', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const tocol = workbook.getCalculation().getFunctions().getByName('TOCOL') as IFunction;
    const container = await mount({ func: tocol, workbook });
    const options = (): string[] =>
      Array.from(document.body.querySelectorAll('[role="option"]')).map(el => el.textContent ?? '');

    // The popup opens on focus, and waits for the descriptor to label its rows.
    await act(async () => { inputs(container)[1].focus(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(options()).toEqual(['Keep all values0', 'Ignore blanks1', 'Ignore errors2', 'Ignore blanks and errors3']);

    // Anything typed is the user's argument, and the values step aside.
    await type(inputs(container)[1], 'A1');
    expect(options()).toEqual([]);
  }, 30_000);
});
