import { memo, forwardRef } from 'react';

import { DefaultCommandButtonRegistry, useCommands } from '@sheetxl/utils-react';

import { CommandGroup, InputCommandButton, type CommandGroupProps } from '@sheetxl/utils-mui';

/**
 * The `textRotateOptions` head - a {@link CommandGroup} whose popup / members come from the registry
 * but whose quick command follows Excel's quirky orientation-button behavior:
 *
 * - By default the quick action applies `formatTextRotate315` ("Angle Counterclockwise").
 * - Once a *custom* angle is set (`formatTextRotateCustom`), the quick action flips to
 *   `formatTextRotate0` so a single click resets the rotation, and the head reads as `selected`.
 *
 * This is the one alignment head that isn't a plain {@link ToggleGroupButton} projection (the active
 * *preset* never moves the head - only the custom angle does), so it keeps a thin dedicated wrapper.
 */
export const TextRotateGroupButton = memo(
  forwardRef<HTMLElement, CommandGroupProps>((props, refForwarded) => {
  const [customCommand] = useCommands(['formatTextRotateCustom']);
  const isSelected = !!customCommand?.getState();

  return (
    <CommandGroup
      ref={refForwarded}
      {...props}
      selected={isSelected}
      quickCommand={isSelected ? 'formatTextRotate0' : 'formatTextRotate315'}
    />
  );
}));

TextRotateGroupButton.displayName = "TextRotateGroupButton";

