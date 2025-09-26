import React, { useMemo, useRef, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Theme, alpha, useTheme } from '@mui/material/styles';

import { Box, Typography } from '@mui/material';
import { DialogTitle } from '@mui/material';
import { IconButton } from '@mui/material';
import { TouchRippleActions } from '@mui/material';
import { Tabs } from '@mui/material';
import { Tab } from '@mui/material';

import { IWorkbook } from '@sheetxl/sdk';

import { ICommands, useImperativeElement, DynamicIcon } from '@sheetxl/utils-react';

import { TaskPaneArea, TaskPaneAreaProps, TaskPaneTitleProps, ITaskPaneAreaElement,
  DefaultTaskPaneRegistry, ITaskPaneStrip, TaskPaneStripAttributes, TaskPaneStripProps
} from '@sheetxl/react';

import { ExhibitTooltip, SimpleTooltip } from '@sheetxl/utils-mui';

export interface StudioTaskPaneAreaProps extends TaskPaneAreaProps {
  commands?: ICommands.IGroup;
  model: IWorkbook;
}

const StudioTaskPaneStrip = memo(forwardRef<ITaskPaneStrip, TaskPaneStripProps>((props, refForward) => {
  const {
    children,
    title,
    taskPanes,
    onSelect,
    selected: propSelected,
    registry = DefaultTaskPaneRegistry,
    style: propsStyle,
    iconsOnly,
    className: propClassName,
    ...rest
  } = props;

  const elements = useMemo(() => {
    return taskPanes.map((key: string) => {
      const entry = registry.getRegisteredTaskPane(key);
      if (!entry) {
        return null;
      }

      let icon = entry.getIcon?.();
      if (icon) {
        if (typeof icon === 'string') {
          icon = <DynamicIcon iconKey={icon}/>;
        }
        icon = (
          <span style={{
            display: 'inline-block',
            transform: 'rotate(90deg)',
            transformOrigin: 'center'
          }}>
            {icon}
          </span>
        )
      }
      const isSelected = key === propSelected;
      return (
        <Tab
          key={key}
          value={key}
          // disableRipple
          label={(
            <SimpleTooltip
              disableInteractive
              title={entry.getTitle() ?? ''}
              // title={''}
              placement="left-start"
            >
              <Box
                sx={{
                  padding: '0px 0px',
                  writingMode: 'vertical-rl',
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
                {icon && (
                  <Box
                    sx={{
                      display: 'inline-block',
                      // transform: 'rotate(90deg)',
                      transformOrigin: 'center',
                      color: (theme: Theme) => {
                        return theme.palette.text.secondary;
                      }
                    }}
                  >
                    {icon}
                  </Box>
                )}
                {(iconsOnly && icon) ? null : (
                  <Typography
                    component="div"
                    textTransform={"none"}
                    sx={{
                      padding: '4px 0px',
                      color: (theme: Theme) => {
                        return isSelected ? theme.palette.primary.main : theme.palette.text.secondary;
                      }
                    }}
                  >
                    {entry.getTitle()}
                  </Typography>
              )}
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
  }, [taskPanes, propSelected, onSelect, registry]);

  const refLocal = useImperativeElement<ITaskPaneStrip, TaskPaneStripAttributes>(refForward, () => {
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
        paddingLeft: '2px',
        paddingTop: '4px',
        ...propsStyle
      }}
      {...rest}
    >
      <Tabs
        orientation="vertical"
        variant="scrollable"
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
              left: '0px',
              right: 'unset'
            }
          }
        }}
      >
        { elements }
      </Tabs>
    </Box>
  );
}));

const renderTaskPaneStrip = (props: TaskPaneStripProps, ref: React.Ref<ITaskPaneStrip>): React.ReactElement => {
  return <StudioTaskPaneStrip ref={ref} {...props} />
}

export const StudioTaskPaneArea = React.forwardRef<ITaskPaneAreaElement, StudioTaskPaneAreaProps>((props, ref) => {
  const {
    commands: commandsApplication,
    model: workbook,
    ...rest
  } = props;
  const disabled = false;//!protection.isStructureAllowed();

  const theme = useTheme();
  const border = `solid ${(!disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled)} 1px`
  const borderRadius = `${theme.shape.borderRadius ?? 4}px`;
  const marginBottom = `${(theme as any).spacing?.(0.5) ?? 4}px`;

  const refRipple = useRef<TouchRippleActions>(null);
  const renderTaskPanelTitle = (props: TaskPaneTitleProps, ref: React.Ref<HTMLDivElement>): React.ReactElement => {
    const {
      title,
      icon,
      onClose,
      readOnly,
      focused,
      ...rest
    } = props;

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
          backgroundColor: (theme: Theme) => {
            return alpha(theme.palette.action.hover, 0.03);
          },
          borderBottom: (theme: Theme) => { // same as toolbar
            return `solid ${alpha(theme.palette.divider, 0.2)} 1px`
          }
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
            label={"Close"}
          >
            <IconButton
              aria-label="close"
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
              <DynamicIcon iconKey="Close" />
            </IconButton>
          </ExhibitTooltip>
        </Box>
      </DialogTitle>
    );
  };


  return (
    <TaskPaneArea
      model={workbook}
      ref={ref}
      frameProps={{
        style: {
          border,
          borderRadius,
          marginBottom
        }
      }}
      alwaysShowStrip={true}
      renderTaskPanelTitle={renderTaskPanelTitle}
      renderTaskPaneStrip={renderTaskPaneStrip}
      {...props}
      onOpen={() => {
        props?.onOpen?.();
      }}
      onClose={() => {
        props?.onClose?.();
      }}
      commands={commandsApplication}
      {...rest}
    >
    </TaskPaneArea>
  )
});