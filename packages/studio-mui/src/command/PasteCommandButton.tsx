import { memo, forwardRef } from 'react';

import {
  CommandGroup, type CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface PasteCommandButtonProps extends CommandPopupButtonProps {
  commandKey: string; // Might be paste options

  /**
   * Duplicate the paste all in the popup as well as the quick button
   * @defaultValue true
   */
  includePasteAllInPopup?:boolean;
}

/**
 * Menu for paste options
 */
export const PasteCommandButton = memo(
  forwardRef<HTMLElement, PasteCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    includePasteAllInPopup = true,
    ...rest
  } = props;

  // The registered `pasteOptions` group leads its popup with a duplicate "Paste" (matching the quick
  // button). When the caller doesn't want that duplicate we render the same group but override its
  // members with just the paste-special variants; `groupKey` still scopes their (compact) labels.
  // Head label/tooltip are NOT passed — `CommandGroup` reads the registered (catalog-backed) entry,
  // so they translate; hardcoding them here would pin the head to English.
  if (!includePasteAllInPopup) {
    return (
      <CommandGroup
        ref={refForwarded}
        groupKey="pasteOptions"
        members={[
          'pasteValues',
          'pasteFormats',
          'pasteFormulas',
          'pasteTranspose',
          'pasteLinks'
        ]}
        quickCommand={'paste'}
        {...rest}
      />
    );
  }

  return (
    <CommandGroup
      ref={refForwarded}
      groupKey="pasteOptions"
      {...rest}
    />
  );
}));
