import React, { useState } from 'react';

import { Box, Collapse, List, ListItem, ListItemButton, ListItemText } from '@mui/material';

import { DynamicIcon } from '@sheetxl/utils-react';

/** The rail's center, from the list's left edge. */
const RAIL_X = 10;
const DOT = 8;
/** Where a row's text starts: past the rail and its dot. */
const TEXT_INSET = RAIL_X * 2 + 12;

/**
 * A record of what happened, as a timeline: flat rows on a rail, one dot per entry. Deliberately not
 * cards — a card reads as an object to manage, and a record is settled.
 */
export const Timeline: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <List
    dense
    disablePadding
    className={className ? `sxl-agent-timeline ${className}` : 'sxl-agent-timeline'}
    sx={{
      position: 'relative',
      '&::before': {
        content: '""', position: 'absolute', left: RAIL_X - 1, top: 12, bottom: 12, width: 2,
        borderRadius: 1, bgcolor: 'divider'
      }
    }}
  >
    {children}
  </List>
);

export interface TimelineEntryProps {
  /** The entry's dot — who or what it was (an intent's color, the agent's). */
  dotColor: string;
  primary: React.ReactNode;
  /** The quiet line under it: when, or where. */
  secondary?: React.ReactNode;
  /**
   * Shown at the row's top right while it is hovered or focused — the row tints, so the action reads
   * as the row's. Each should stop its click from reaching the row.
   */
  actions?: React.ReactNode;
  /** What clicking the row does. Ignored when there are {@link details}: the click discloses them. */
  onClick?: () => void;
  /** Disclosed in place under the row. */
  details?: React.ReactNode;
  className?: string;
}

/** One {@link Timeline} entry: a row with its dot on the rail, actions on hover, details on click. */
export const TimelineEntry: React.FC<TimelineEntryProps> = (props) => {
  const { dotColor, primary, secondary, actions, onClick, details, className } = props;
  const [open, setOpen] = useState(false);
  const expandable = details !== undefined && details !== null;
  const activate = expandable ? () => setOpen((o: boolean) => !o) : onClick;

  const content = (
    <>
      <Box
        component="span"
        aria-hidden
        sx={{ position: 'absolute', left: RAIL_X - DOT / 2, top: 12, width: DOT, height: DOT, borderRadius: '50%', bgcolor: dotColor }}
      />
      <ListItemText
        primary={primary}
        secondary={secondary}
        sx={{ my: 0 }}
        slotProps={{
          primary: { variant: 'body2', noWrap: true },
          secondary: { variant: 'caption', noWrap: true, sx: { color: 'text.disabled', display: 'block' } }
        }}
      />
      {expandable ? (
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', ml: 0.5, mt: 0.25 }}>
          <DynamicIcon iconKey={open ? 'ExpandLess' : 'ExpandMore'} size={16} ariaHidden />
        </Box>
      ) : null}
    </>
  );

  const rowSx = { position: 'relative', alignItems: 'flex-start', pl: `${TEXT_INSET}px`, py: 0.5, borderRadius: 1 } as const;

  return (
    <>
      <ListItem
        disablePadding
        className={className}
        secondaryAction={actions}
        sx={{
          borderRadius: 1,
          // A clickable row tints itself (it is a button); a plain one tints here, so every entry
          // answers the pointer the same way.
          ...(!activate ? { '&:hover': { bgcolor: 'action.hover' } } : null),
          // Top-aligned with the description rather than centered on the two lines.
          '& .MuiListItemSecondaryAction-root': {
            top: 2, transform: 'none', opacity: 0, transition: 'opacity 0.15s ease'
          },
          '&:hover .MuiListItemSecondaryAction-root, &:focus-within .MuiListItemSecondaryAction-root': { opacity: 1 }
        }}
      >
        {activate ? (
          <ListItemButton onClick={activate} aria-expanded={expandable ? open : undefined} sx={rowSx}>
            {content}
          </ListItemButton>
        ) : (
          // Nothing to do on a click: a plain row, not a button that does nothing.
          <Box sx={{ ...rowSx, display: 'flex', width: '100%', pr: 2 }}>{content}</Box>
        )}
      </ListItem>
      {expandable ? (
        <Collapse in={open} unmountOnExit>
          <Box sx={{ pl: `${TEXT_INSET}px`, pr: 1, pb: 1 }}>{details}</Box>
        </Collapse>
      ) : null}
    </>
  );
};
