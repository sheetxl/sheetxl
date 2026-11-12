import type React from 'react';
import { memo } from 'react';

import { type CommandButtonEntry } from './CommandButtonRegistry';
import { useCommandButtonRegistry } from './CommandButtonRegistryContext';

/**
 * The registered {@link CommandButtonEntry} for `key` (context registry, singleton fallback),
 * re-rendering the caller on a language switch (via {@link useCommandButtonRegistry}'s
 * subscription) so entry chrome read during render never goes stale.
 */
export function useCommandButtonEntry(key: string): CommandButtonEntry | null {
  return useCommandButtonRegistry().get(key);
}

export interface CommandButtonEntryLabelProps {
  /** The registered entry whose label to render. */
  entryKey: string;
  /** The panel/surface the label renders in (the entry's `getLabel` scope), if any. */
  groupKey?: string;
  /** Rendered when the entry is not registered (or has no label). */
  fallback?: React.ReactNode;
}

/**
 * A registered entry's **label**, self-resolving and language-aware — the text-only counterpart
 * of `CommandButton` for chrome that needs JUST the label (ribbon tabs, menu headers). Give a
 * surface `<CommandButtonEntryLabel entryKey="homeToolbar"/>` instead of a plucked string: the
 * element resolves at ITS OWN render through the (translated) entry and re-renders itself on a
 * language switch, so containers can memoize their structure without baking strings.
 */
export const CommandButtonEntryLabel = memo((props: CommandButtonEntryLabelProps) => {
  const { entryKey, groupKey, fallback } = props;
  const entry = useCommandButtonEntry(entryKey);
  return <>{(entry?.getLabel?.(groupKey) as React.ReactNode) ?? fallback ?? entryKey}</>;
});

CommandButtonEntryLabel.displayName = 'CommandButtonEntryLabel';
