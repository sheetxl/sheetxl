/* cspell: disable */
import { Scalar, IRange } from '@sheetxl/primitives';

/**
 * @hidden Testing
 * @summary Returns the input value after a delay.
 * @param time the delay time in milliseconds. Default is 1000ms (1 second).
 * @param input returns the input.
 * @param label optional label for the delay function.
 */
export async function DELAY(time: number, input: Scalar, label: string='No label'): Promise<Scalar> {
  // console.log(`DELAY(${time}${label ? `, ${label}` : ''})`, time);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(input);
    }, time);
  });
}

// ---------------------------------------------------------------------------
// 🚌  Tiny channel per event-type (FIFO, 1-to-1 producer/consumer)
// ---------------------------------------------------------------------------

// global singleton you can use from DevTools
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

/**
 * @hidden Testing
 * @summary Starts waiting for event
 * @param type the type of message.
 * @param input an optional dependency.
 *
 * @remarks
 * To use:
 *  '=WAIT("test", A1)'
 *   [globalThis].debugEventTarget.dispatchEvent(new CustomEvent(type, payload));
 *   (e.g. globalThis.debugEventTarget.dispatchEvent(new CustomEvent('test', { detail: "ping" }));
 */
export async function WAIT(type: string, input?: IRange): Promise<string> {
  const payload = await nextEvent(type);      // one event ➜ one promise
  let inputValue = input?.getValueAt(0, 0) ?? ''; // force the value to be read
  let message = `event["${type}"`;
  if (payload !== undefined) {
    message += `, payload: ${payload}`;
  }
  if (inputValue !== '') {
    message += `, input: ${inputValue}`;
  }
  message += ']';
  console.log(message);
  return '' + payload + inputValue;
}