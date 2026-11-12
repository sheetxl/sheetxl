import { type ICommandDefinition } from './ICommandDefinition';

/**
 * The result of reducing an ordered (**least → most specific**) list of
 * {@link ICommandDefinition} for a single key.
 *
 * Merge rule: **override** for every property (the most-specific contribution wins),
 * **except the {@link ACCUMULATE} fields** (`disabledReasons`, `tags`) which **accumulate**
 * — concatenated, most-specific first — so reasons/tags from different scopes stack instead
 * of clobbering. (Atomic handling of `shortcut` is still a deferred cleanup; see
 * design/COMMAND-DESIGN.md.)
 *
 * `contributedBy` records which contribution index supplied each property — the cascade
 * **introspection** hook (the "CSS devtools" requirement) that keeps the cascade debuggable.
 */
/** Fields that **accumulate** (concat) across the chain instead of overriding. */
export const ACCUMULATE: ReadonlySet<string> = new Set(['disabledReasons', 'tags']);

export interface ReducedDefinition<STATE = any, CONTEXT = any, ARGS = void> {
  key: string;
  /** The winning (most-specific) value for each contributed property. */
  props: Partial<ICommandDefinition<STATE, CONTEXT, ARGS>>;
  /** property name → index (in `defs`) of the contribution that supplied it. */
  contributedBy: Record<string, number>;
}

/**
 * Reduce all contributions for ONE command key into a {@link ReducedDefinition}.
 * The heart of "reduce up the chain": the registry calls this with the contributions
 * gathered along the active scope chain, ordered **least → most specific**.
 *
 * Cross-scope reduction lives here; within-scope merging (successive `updateCommand` calls
 * on one provider) happens before this, so each `defs` entry is one scope's merged value.
 */
export function reduceDefinitions<STATE = any, CONTEXT = any, ARGS = void>(
  key: string,
  defs: readonly ICommandDefinition<STATE, CONTEXT, ARGS>[]
): ReducedDefinition<STATE, CONTEXT, ARGS> {
  const props: Partial<ICommandDefinition<STATE, CONTEXT, ARGS>> = {};
  const contributedBy: Record<string, number> = {};

  const defsLength = defs.length;
  for (let i = 0; i < defsLength; i++) {
    const def = defs[i];
    if (def.key !== key) {
      // Caller bug: a contribution for a different key leaked into this reduction.
      throw new Error(`reduceDefinitions: contribution key '${def.key}' != '${key}'`);
    }
    for (const prop in def) {
      if (prop === 'key') continue;
      const value = (def as unknown as Record<string, unknown>)[prop];
      if (value === undefined) continue; // absent — skip (null is meaningful: "clear")
      if (ACCUMULATE.has(prop) && Array.isArray(value)) {
        // Accumulate: concat with the most-specific (processed last) prepended to the front.
        const existing = (props as Record<string, unknown>)[prop] as unknown[] | undefined;
        (props as Record<string, unknown>)[prop] = [...(value as unknown[]), ...(existing ?? [])];
      } else {
        (props as Record<string, unknown>)[prop] = value; // most-specific wins
      }
      contributedBy[prop] = i;
    }
  }

  return { key, props, contributedBy };
}
