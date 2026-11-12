/* cspell: disable */
import { FormulaContext, FormulaError, type IFormulaContext, type Scalar, type IRange } from '@sheetxl/primitives';

interface DelayPayload {
  time: number;
  input: Scalar;
}

/** Answers each call with its input once its time has run; a call the sheet no longer wants is cleared. */
function runDelays(calls: readonly IFormulaContext.DeferredCall<Scalar>[]): void {
  for (const call of calls) {
    const { time, input } = call.payload as DelayPayload;
    const timer = setTimeout((): void => call.resolve(input), time);
    call.onCancel((): void => clearTimeout(timer));
  }
}

/**
 * Returns the input value after a delay.
 * @hidden Testing
 * @param time the delay time in milliseconds. Default is 1000ms (1 second).
 * @param input returns the input.
 * @param label optional label for the delay function.
 * @category SheetXL
 */
export function DELAY(time: number, input: Scalar, label: string='No label'): Scalar {
  FormulaContext.defer(runDelays, { time, input });
  return FormulaError.BuiltIn.Busy;
}

// ---------------------------------------------------------------------------
// 🚌  Tiny channel per event-type (FIFO, 1-to-1 producer/consumer)
// ---------------------------------------------------------------------------

declare global {
  // global singleton you can use from DevTools
  var debugEventTarget: EventTarget | undefined;
}

globalThis.debugEventTarget ??= new EventTarget();
const eventTarget = globalThis.debugEventTarget; // for easier typing

type Resolver<T> = (value: T | PromiseLike<T>) => void;

const channels = new Map<
  string,
  {
    inbox: any[];           // queued messages
    waiters: Resolver<any>[]; // pending resolvers
  }
>();

function ensureChannel(type: string) {
  if (channels.has(type)) return channels.get(type)!;

  const state = { inbox: [] as any[], waiters: [] as Resolver<any>[] };

  // one *global* recorder per event-type
  eventTarget.addEventListener(type, (e: any) => {
    if (state.waiters.length) {
      // someone is waiting → hand the message to the oldest waiter
      state.waiters.shift()!(e.detail);
    } else {
      // no waiter yet → buffer it
      state.inbox.push(e.detail);
    }
  });

  channels.set(type, state);
  return state;
}

/** Returns a Promise that resolves with the *next* message of `type`. */
function nextEvent<T = any>(type: string): Promise<T> {
  const { inbox, waiters } = ensureChannel(type);

  if (inbox.length) {
    // synchronous — something already queued
    return Promise.resolve(inbox.shift() as T);
  }
  // nothing queued → park the resolver
  return new Promise<T>((res) => waiters.push(res));
}

interface WaitPayload {
  type: string;
  inputValue: Scalar;
}

/** Answers each call with the next event of its type: one event, one call. */
function runWaits(calls: readonly IFormulaContext.DeferredCall<string>[]): void {
  for (const call of calls) {
    const { type, inputValue } = call.payload as WaitPayload;
    void nextEvent(type).then((payload: unknown): void => {
      let message = `event["${type}"`;
      if (payload !== undefined) {
        message += `, payload: ${payload}`;
      }
      if (inputValue !== '') {
        message += `, input: ${inputValue}`;
      }
      message += ']';
      console.log(message);
      call.resolve('' + payload + inputValue);
    });
  }
}

/**
 * Starts waiting for event
 * @hidden Testing
 * @param type the type of message.
 * @param input an optional dependency.
 *
 * @remarks
 * To use:
 *  '=WAIT("test", A1)'
 *   [globalThis].debugEventTarget.dispatchEvent(new CustomEvent(type, payload));
 *   (e.g. globalThis.debugEventTarget.dispatchEvent(new CustomEvent('test', { detail: "ping" }));
 * @category SheetXL
 */
export function WAIT(type: string, input?: IRange): string {
  const inputValue = input?.getValueAt(0, 0) ?? ''; // force the value to be read
  FormulaContext.defer(runWaits, { type, inputValue });
  // The cell shows an error until the event lands; an error passes through a text return.
  return FormulaError.BuiltIn.Busy as unknown as string;
}
