/**
 * In-flight locale REGISTRATIONS (not loads).
 *
 * A package registers its message slice by reading manifests over the network, so registration is
 * itself async. Without this, the reveal gate has a hole that no amount of awaiting can close: a host
 * awaits `prefetch()`, but `prefetch` can only wait for slices that exist *at the moment it is
 * called*. A package whose manifest read has not landed yet is invisible to it, so the gate opens,
 * the first render happens, and that package's strings resolve to their keys until the fetch
 * completes — the exact flash the gate exists to prevent.
 *
 * A leaf module (no imports) so both the language-pack service and the registration helpers can use
 * it without a cycle.
 */

/** Registrations that have not settled yet. */
const _pending = new Set<Promise<unknown>>();

/** Track an in-flight registration so {@link whenLocalesRegistered} covers it. Returns the promise. */
export function trackLocaleRegistration<T>(promise: Promise<T>): Promise<T> {
  _pending.add(promise);
  void promise.catch(() => { /* the registrant reports; this set only tracks settlement */ })
    .finally(() => { _pending.delete(promise); });
  return promise;
}

/**
 * Resolve once every in-flight registration has settled. Loops because one registration can start
 * another (a manifest read that registers per-locale loaders).
 */
export async function whenLocalesRegistered(): Promise<void> {
  while (_pending.size) await Promise.all([..._pending].map((p) => p.catch(() => undefined)));
}
