import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { useCommands, useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { type CommandContext, SlicerStylePreview, getSlicerStyleNames } from '@sheetxl/react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

export interface PresetSlicerStylesCommandButtonProps extends CommandPopupButtonProps {
  /** The command a style is applied with; it takes the style's name. */
  commandKey: string;
}

/** Swatch size, and the gallery's width: six swatches across, as Excel's. */
const SWATCH_WIDTH = 56;
const SWATCH_HEIGHT = 60;
const ACROSS = 6;

/**
 * The slicer-style gallery: every slicer style drawn as a small slicer, grouped Custom, Light, Other
 * and Dark, the slicer's own style outlined. Picking one applies it to the active slicer.
 */
export const PresetSlicerStylesCommandButton = memo(
  forwardRef<HTMLElement, PresetSlicerStylesCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const t = useTranslator();
  const command = useCommands<string, CommandContext.Slicer>([commandKey])[0];
  const context: CommandContext.Slicer | undefined = command?.getContext();
  const styles = context?.styles() ?? null;
  const selectedName: string | undefined = command?.getState();

  const handleSelect = useCallbackRef((styleName: string) => {
    command?.execute(styleName);
  }, [command]);

  const renderPopupPanel = useCallback((_props: ExhibitPopupPanelProps) => {
    const names = getSlicerStyleNames(styles);
    const category = (label: string, styleNames: string[], showDivider: boolean): React.ReactNode => {
      if (styleNames.length === 0) return null;
      return (
        <Box key={label}>
          {showDivider ? <ExhibitDivider orientation="horizontal"/> : null}
          <ExhibitMenuHeader>{label}</ExhibitMenuHeader>
          <Box
            sx={{
              display: 'flex',
              gap: '2px',
              marginBottom: '6px',
              flexWrap: 'wrap',
              width: `${(SWATCH_WIDTH + 3 + 3) * ACROSS + (2 * (ACROSS - 1))}px`,
              maxWidth: '100%'
            }}
          >
            {styleNames.map((styleName: string) => (
              <ExhibitIconButton
                key={styleName}
                sx={{
                  borderRadius: '2px',
                  padding: '2px',
                  margin: '0px',
                  display: 'flex',
                  border: (theme: Theme) => `solid ${styleName === selectedName ? theme.palette.primary.dark : 'transparent'} 1px`
                }}
                propsTooltip={{
                  label: styleName,
                  placement: 'bottom-start'
                }}
                disabled={propDisabled}
                icon={null}
                onClick={() => handleSelect(styleName)}
              >
                <SlicerStylePreview
                  styleName={styleName}
                  styles={styles}
                  width={SWATCH_WIDTH}
                  height={SWATCH_HEIGHT}
                />
              </ExhibitIconButton>
            ))}
          </Box>
        </Box>
      );
    };
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '100%',
          padding: '6px 16px',
          paddingTop: (theme: Theme) => `calc(${theme.shape.borderRadius}px + 6px)`,
          paddingBottom: (theme: Theme) => `calc(${theme.shape.borderRadius}px + 6px)`
        }}
      >
        {category(t('slicerStyle.category.custom'), names.custom, false)}
        {category(t('slicerStyle.category.light'), names.light, names.custom.length > 0)}
        {category(t('slicerStyle.category.other'), names.other, true)}
        {category(t('slicerStyle.category.dark'), names.dark, true)}
      </Box>
    );
  }, [styles, styles?.getTheme(), selectedName, propDisabled, t]);

  const isDisabled = propDisabled ?? (!command || command.disabled());
  return (
    <CommandPopupButton
      ref={refForwarded as React.Ref<HTMLDivElement>}
      renderPopupPanel={renderPopupPanel}
      label={command?.getLabel(groupKey)}
      groupKey={groupKey}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel()}
          description={command?.getDescription()}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      disabled={isDisabled}
      icon={command?.getIcon()}
      {...rest}
    />
  );
}));

PresetSlicerStylesCommandButton.displayName = 'PresetSlicerStylesCommandButton';
