import type React from 'react';
import { useEffect } from 'react';

import { getRangeAnnotationState, usePresenceSnapshot, type PresenceStore } from '@sheetxl/react';

/**
 * Esc clears the agent's `working` cursor; `finding` and `question` findings stay until dismissed.
 *
 * @remarks
 * Not attached while a prompt is open: the prompt's window takes Esc there. While an annotation's
 * card is open (current or hovered), Esc is the annotation layer's, which closes the card; the next
 * Esc clears the cursor.
 */
export const PresenceOverlay: React.FC<{ store: PresenceStore }> = ({ store }) => {
  const { prompt, working, workbook } = usePresenceSnapshot(store);
  const hasWorking = !!working;

  useEffect(() => {
    if (!hasWorking || prompt) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const annotations = workbook ? getRangeAnnotationState(workbook) : null;
      if (annotations?.current || annotations?.hovered) return;
      store.clearWorking();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hasWorking, prompt, store, workbook]);

  return null;
};
