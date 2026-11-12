import type React from 'react';
import { useMemo, useRef, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { alpha, useTheme, type Theme } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { DialogTitle } from '@mui/material';
import { IconButton } from '@mui/material';
import { type TouchRippleActions } from '@mui/material';
import { Tabs } from '@mui/material';
import { Tab } from '@mui/material';

import { type IWorkbook } from '@sheetxl/sdk';

import { useImperativeElement, DynamicIcon, useTranslator, useLanguage } from '@sheetxl/utils-react';

import {
  DefaultTaskPaneRegistry, TaskPaneArea, type TaskPaneAreaProps, type TaskPaneTitleProps, type ITaskPaneAreaElement,
  type ITaskPaneStrip, type TaskPaneStripAttributes, type TaskPaneStripProps
} from '@sheetxl/react';

import { ExhibitTooltip, SimpleTooltip } from '@sheetxl/utils-mui';

/**
 * The field border — `--sxl-color-input-border`, the same token the formula bar and the field widgets read, so
 * a pane frame and the toolbar above it stay one control. Read at FULL strength (not `alpha(divider, .2)`,
 * which only reads as a border because MUI's own divider is already translucent and collapses to nothing on a
 * host supplying an opaque one). Disabled still needs MUI — no token names a disabled border.
 */
const FIELD_BORDER_COLOR = 'var(--sxl-color-input-border, light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2)))';

export interface StudioTaskPaneAreaProps extends TaskPaneAreaProps {
  model?: IWorkbook;
}

const StudioTaskPaneStrip = memo(forwardRef<ITaskPaneStrip, TaskPaneStripProps>(
  (props: TaskPaneStripProps, refForwarded) => {
  const {
    children,
    title,
    taskPanes,
    onSelect,
    selected: propSelected,
    registry = DefaultTaskPaneRegistry,
    style: propsStyle,
    iconsOnly,
    side = 'right',
    className: propClassName,
    ...rest
  } = props;

  const isLeft = side !== 'right';
  // Subscribe to language: entry titles resolve through the catalog, so a switch must rebuild.
  const language = useLanguage();
  const elements = useMemo(() => {
    return taskPanes.map((key: string) => {
      const entry = registry.getRegisteredTaskPane(key);
      if (!entry) {
        return null;
      }

      let icon = entry.getIcon?.();
      if (typeof icon === 'string') {
        icon = <DynamicIcon iconKey={icon}/>;
      }
      const isSelected = key === propSelected;
      const elementIcon = icon ? (
        <Box
          sx={{
            display: 'inline-block',
            // Icons don't auto-rotate with the vertical writing mode (only glyphs do),
            // so rotate them to match the text direction on each side.
            transform: isLeft ? `rotate(-90deg)` : `rotate(90deg)`,
            transformOrigin: 'center',
            color: (theme: Theme) => {
              return theme.palette.text.secondary;
            }
          }}
        >
          {icon}
        </Box>
      ) : null;
      // Icon-less entries always keep their label; the tab would otherwise be empty.
      const showLabel = !icon || (!iconsOnly && isSelected);
      // The label stays mounted inside a 0fr/1fr grid track so the transition runs
      // to the text's real size (a max-height cap adds dead time that desyncs the
      // in/out animations). In the vertical writing mode the text's length is the
      // inline axis, so grid-template-columns is the track that animates it.
      const elementText = (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: showLabel ? '1fr' : '0fr',
            opacity: showLabel ? 1 : 0,
            transition: (theme: Theme) => theme.transitions.create(
              ['grid-template-columns', 'opacity'],
              { duration: theme.transitions.duration.short }
            )
          }}
        >
          <Box
            sx={{
              overflow: 'hidden',
              minWidth: 0,
              minHeight: 0
            }}
          >
            <Typography
              component='div'
              sx={{
                textTransform: 'none',
                whiteSpace: 'nowrap', // clip while collapsing; never re-wrap
                transform: isLeft ? `rotate(180deg)` : undefined,
                padding: '4px 0px',
                color: (theme: Theme) => {
                  return isSelected ? theme.palette.primary.main : theme.palette.text.secondary;
                }
              }}
            >
              {entry.getTitle()}
            </Typography>
          </Box>
        </Box>
      );
      return (
        <Tab
          key={key}
          value={key}
          // disableRipple
          label={(
            <SimpleTooltip
              disableInteractive
              title={entry.getTitle() ?? ''}
              placement='left-start'
            >
              <Box
                sx={{
                  padding: '0px 0px',
                  writingMode: isLeft ? 'vertical-lr' : 'vertical-rl',
                  textOrientation: 'mixed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: '0px',
                  color: (theme: Theme) => {
                    return theme.palette.text.secondary;
                  }
                }}
              >
                { isLeft ? elementText : elementIcon }
                { isLeft ? elementIcon : elementText }
              </Box>
            </SimpleTooltip>
          )}
          sx={{
            padding: '4px 4px',
            minWidth: '0px',
            minHeight: '0px',
            borderRadius: '4px'
          }}
          className={clsx('taskpane-strip-item', {
            'Mui-selected': isSelected
          })}
          onClick={() => props.onSelect(key)}
        />
      );
    });
  }, [taskPanes, propSelected, onSelect, registry, isLeft, iconsOnly, language]);

  const refLocal = useImperativeElement<ITaskPaneStrip, TaskPaneStripAttributes>(refForwarded, () => {
    return {
      isTaskPaneStrip: () => true
    }
  }, []);

  const className = useMemo(() => {
    return clsx('taskpane-strip', propClassName);
  }, [propClassName]);

  return (
    <Box
      ref={refLocal}
      className={className}
      sx={{
        paddingLeft: isLeft ? undefined : '2px',
        paddingRight: isLeft ? '2px' : undefined,
        paddingTop: '4px',
        ...propsStyle
      }}
      {...rest}
    >
      <Tabs
        orientation='vertical'
        variant='scrollable'
        value={propSelected}
        onChange={(_, newValue) => {
          onSelect(newValue);
        }}
        slotProps={{
          list: {
            sx: {
              gap: '2px',
            }
          },
          indicator: {
            sx: {
              left: isLeft ? undefined : '0px',
              right: isLeft ? undefined : 'unset',
              bottom: isLeft ? '0px' : undefined
            }
          }
        }}
      >
        { elements }
      </Tabs>
    </Box>
  );
}));

const StudioTaskPaneTitle = (props: TaskPaneTitleProps): React.ReactElement => {
  const {
    title,
    icon,
    onClose,
    readOnly,
    focused,
    ...rest
  } = props;

  const refRipple = useRef<TouchRippleActions>(null);

  const t = useTranslator();

  return (
      <DialogTitle
        className={clsx({
          ['Mui-selected']: focused
        })}
        sx={{
          display: 'flex',
          flex: '1 1 %0',
          color: (theme: Theme) => theme.palette.text.secondary,
          boxSizing: 'border-box',
          padding: '0 0', // measure is not honoring border-box directive so we moved the paddings to the children
          transitionProperty: 'opacity',
          transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest}ms`, // should also use leaving screen with a second class
          opacity: 0.7,
          '&.Mui-selected': {
            opacity: 1,
            transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest / 2}ms`, // should also use leaving screen with a second class
          },
          // An app-local wash, deliberately NOT a token read: "a title bar sits a step above what it
          // covers" is a style choice this app makes, and no host theming system names that color. Being
          // translucent it lifts whatever surface the pane lands on by the same amount, so it needs no
          // per-placement value.
          backgroundColor: (theme: Theme) => alpha(theme.palette.action.hover, 0.03),
          borderBottom: `solid ${FIELD_BORDER_COLOR} 1px` // same as toolbar
        }}
        {...rest}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 10%',
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: (theme: Theme) => theme.spacing(0.25),
            marginBottom: (theme: Theme) => theme.spacing(0.25),
            marginLeft: (theme: Theme) => theme.spacing(1),
            marginRight: (theme: Theme) => theme.spacing(1),
          }}
        >
          <Box
            sx={{
              flex: '1 1 100%',
              paddingLeft: (theme: Theme) => theme.spacing(1),
            }}
          >
            {title}
          </Box>
          <ExhibitTooltip
            label={t('taskPane.close')}
          >
            <IconButton
              aria-label='close'
              sx={{
                color: (theme: Theme) => {
                  return ((theme.palette.text as any).icon ?? theme.palette.action.active);
                }
              }}
              touchRippleRef={refRipple}
              onPointerDown={(e) => {
                refRipple.current?.start(e, {
                  center: false
                });
                e.stopPropagation();
                e.preventDefault();
              }}
              onPointerUp={() => {
                onClose();
              }}
            >
              <DynamicIcon iconKey='Close' />
            </IconButton>
          </ExhibitTooltip>
        </Box>
      </DialogTitle>
  );
};

export const StudioTaskPaneArea = forwardRef<ITaskPaneAreaElement, StudioTaskPaneAreaProps>(
  (props: StudioTaskPaneAreaProps, refForwarded) => {
  const {
    model: workbook,
    side,
    ...rest
  } = props;
  const disabled = false;//!protection.isStructureAllowed();

  const theme = useTheme();
  const border = `solid ${(!disabled ? FIELD_BORDER_COLOR : theme.palette.action.disabled)} 1px`
  const borderRadius = `${theme.shape.borderRadius ?? 4}px`;
  const marginBottom = `${(theme as any).spacing?.(0.5) ?? 4}px`;

  return (
    <TaskPaneArea
      model={workbook}
      ref={refForwarded}
      propsFrame={{
        style: {
          border,
          borderRadius,
          marginBottom
        }
      }}
      alwaysShowStrip={true}
      componentTitle={StudioTaskPaneTitle}
      componentStrip={StudioTaskPaneStrip}
      side={side}
      {...props}
      onOpen={() => {
        props?.onOpen?.();
      }}
      onClose={() => {
        props?.onClose?.();
      }}
      {...rest}
    >
    </TaskPaneArea>
  )
});