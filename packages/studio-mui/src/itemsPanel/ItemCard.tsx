import type React from 'react';
import { memo, useState, useEffect, useMemo, useReducer } from 'react';

import clsx from 'clsx';

import { Box, Paper, Typography, IconButton } from '@mui/material';
import { type SxProps, type Theme } from '@mui/material';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';
import { SimpleTooltip } from '@sheetxl/utils-mui';

import { type ItemBodyProps, type ItemMessageKeys } from './ItemsDescriptor';

import styles from './Items.module.css';

export interface ItemCardProps<T=any> extends React.HTMLAttributes<HTMLDivElement> {
  item: T;
  /**
   * The feature's catalog keys for the built-in action tooltips. A built-in action whose key is
   * missing is not offered.
   */
  messageKeys: Partial<Pick<ItemMessageKeys, 'moveUp' | 'moveDown' | 'edit' | 'duplicate' | 'delete'>>;
  /**
   * The one-line header.
   */
  title: string;
  /**
   * The emphasized line below the header. `null` renders nothing.
   */
  subtitle?: string | null;
  /**
   * A quiet second line under the title, beside the {@link Media}. For a detail that belongs to the
   * title (where an item is) rather than a section of the card under a divider, as {@link subtitle}
   * is. With a caption the media and the actions align to the title's line rather than centering on
   * the two lines.
   */
  caption?: React.ReactNode;
  /**
   * Hides every action affordance.
   */
  readOnly?: boolean;
  /**
   * Marks the card as the one the host is pointing at (the item revealed on the grid). Drawn as the
   * focus outline, without taking focus.
   */
  selected?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /**
   * Omit for an item with no editor — the title is then plain text and no edit action is offered.
   * See `ItemsDescriptor.createDraft`.
   */
  onEdit?: () => void;
  /**
   * A click on the card's surface — anywhere that is not the title, an action, or a control the
   * card carries. Omit when there is nothing on the grid to select.
   */
  onSelect?: () => void;
  /**
   * Omit to hide the move affordances (unordered list).
   */
  onMoveBy?: (delta: number) => void;
  /**
   * Omit to hide the duplicate affordance.
   */
  onDuplicate?: () => void;
  /**
   * Omit to hide the delete affordance.
   */
  onDelete?: () => void;
  /**
   * The feature's own actions, shown in the hover row ahead of the built-in ones. Use
   * {@link ItemCardAction} so they look and behave as the built-in ones do.
   */
  actions?: React.ReactNode;
  /**
   * Subscribes to the item's own events to re-render this card.
   */
  subscribeItem?: (item: T, onChange: () => void) => () => void;
  /**
   * Merged over the card's own styling — a host's accent (`'&.Mui-selected'`'s outline) or density
   * (`gap`).
   */
  sx?: SxProps<Theme>;
  /**
   * Leading visual at the card's top-left, before the title.
   */
  Media?: React.ComponentType<ItemBodyProps<T>>;
  /**
   * Feature content below the subtitle.
   */
  Body?: React.ComponentType<ItemBodyProps<T>>;
  /**
   * Renders the subtitle line instead of {@link subtitle}, for a feature whose subtitle is a
   * control rather than a string — a range the card lets you edit in place.
   */
  Subtitle?: React.ComponentType<ItemBodyProps<T>>;
}

export interface ItemCardActionProps {
  /** The tooltip, already translated. Also the button's accessible name. */
  title: string;
  iconKey: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * One action in a card's hover row — the built-in ones (move, edit, duplicate, delete) and a
 * feature's own (`ItemCardProps.actions`) alike. Its click does not reach the card.
 */
export const ItemCardAction = memo<ItemCardActionProps>(({ title, iconKey, onClick, disabled }) => (
  <SimpleTooltip disableInteractive title={title}>
    {/* A disabled button fires no events; the tooltip listens on the wrapper instead. */}
    <Box component="span" sx={{ display: 'inline-flex' }}>
      <IconButton
        size="small"
        aria-label={title}
        style={{ padding: '2px' }}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey={iconKey} />
      </IconButton>
    </Box>
  </SimpleTooltip>
));

ItemCardAction.displayName = 'ItemCardAction';

/**
 * Card chrome for one listed item: hover/focus action row (move/edit/duplicate/delete), title,
 * subtitle (a string, or a feature's own control via {@link ItemCardProps.Subtitle}), and an
 * optional feature body.
 */
const ItemCardImpl = memo(<T=any,>(props: ItemCardProps<T>) => {
  const {
    item,
    messageKeys,
    title,
    subtitle,
    caption,
    Subtitle,
    readOnly = false,
    selected = false,
    canMoveUp = false,
    canMoveDown = false,
    onEdit,
    onSelect,
    onMoveBy,
    onDuplicate,
    onDelete,
    actions,
    subscribeItem,
    Media,
    Body,
    className: propClassName,
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  /* Two different things the card can be denied. `readOnly` hides EVERY action; an item with no
     editor keeps its actions and loses only the way in to one. */
  const canEdit = !readOnly && !!onEdit;
  const hasCaption = caption !== undefined && caption !== null;

  const [isActive, setIsActive] = useState<boolean>(false);
  const [_renderNonce, forceRender] = useReducer((s: number) => s + 1, 0);

  useEffect(() => {
    if (!subscribeItem) return;
    return subscribeItem(item, forceRender);
  }, [item, subscribeItem]);

  useEffect(() => {
    if (isActive) {
      // TODO - highlight the item's ranges on the grid (wanted by every feature)
    } else {
      // TODO - clear the range highlight
    }
  }, [isActive]);

  const className = useMemo(() => {
    return clsx('sxl-item-card', 'sxl-anchor-item-card', propClassName, {
      ['sxl-read-only']: readOnly,
      ['Mui-selected']: selected
    }, styles['card'])
  }, [propClassName, readOnly, selected]);

  return (
    <Paper
      tabIndex={0}
      {...rest}
      onMouseOver={(e) => {
        setIsActive(true);
        rest?.onMouseOver?.(e);
     }}
      onMouseLeave={(e) => {
        setIsActive(false);
        rest?.onMouseLeave?.(e);
      }}
      onClick={(e) => {
        rest?.onClick?.(e);
        if (!onSelect || e.defaultPrevented) return;
        // Controls on the card act for themselves. The check is on the TARGET rather than on
        // each control stopping propagation: a field the card carries may be picking its range
        // from the grid, and a click in it that also moved the grid selection would pick that.
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, button, a, [role="button"], [contenteditable], .MuiFormControl-root')) return;
        onSelect();
      }}
      sx={[{
        gap: (theme: Theme) => theme.spacing(1),
        // A card with somewhere to take the user is pressed like a link.
        cursor: onSelect ? 'pointer' : undefined,
        paddingTop: (theme: Theme) => theme.spacing(1.25),
        paddingBottom: (theme: Theme) => theme.spacing(1.25),
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: (theme: Theme) => theme.spacing(1.25),
        '&.Mui-selected': {
          outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`
        },
        '&:hover': {
          boxShadow: readOnly ? undefined : 1,
          '& .anchor-item-card-actions': {
            opacity: 1,
            width: 'auto',
          }
        },
        '&:focus-within': {
          outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
          boxShadow: readOnly ? undefined : 1,
          '& .anchor-item-card-actions': {
            opacity: 1,
            width: 'auto',
          }
        }
      }, ...(Array.isArray(propSx) ? propSx : [propSx])]}
      className={className}
    >
      <Box
        className="anchor-item-card-header"
        sx={{
          display: 'flex',
          alignItems: hasCaption ? 'flex-start' : 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          className="anchor-item-card-title"
          sx={{
            display: 'flex', alignItems: hasCaption ? 'flex-start' : 'center', gap: (theme: Theme) => theme.spacing(1), flex: 1, minWidth: 0,
          }}
        >
          {Media ? <Media item={item} /> : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: (theme: Theme) => theme.palette.text.secondary,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                cursor: canEdit ? 'pointer' : undefined,
                '&:hover': {
                  color: (theme: Theme) => {
                    if (!canEdit) return undefined;
                    return theme.palette.primary.main;
                  },
                }
              }}
              onClick={(e) => {
                // With no editor to open the title is plain text, and the click falls through to
                // the surface — which is where `onSelect` lives.
                if (!canEdit) return;
                e.stopPropagation();
                onEdit!();
              }}
            >
              {title}
            </Typography>
            {hasCaption ? (
              <Typography
                variant="caption"
                className="anchor-item-card-caption"
                sx={{ color: 'text.disabled', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
              >
                {caption}
              </Typography>
            ) : null}
          </Box>
        </Box>
        { !readOnly && (
          <Box
            className="anchor-item-card-actions"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: (theme: Theme) => theme.spacing(0),
              flexShrink: 0,
              opacity: 0,
              width: 0,
              overflow: 'hidden',
              transition: 'opacity 0.2s ease, width 0.2s ease',
            }}
          >
            {actions}
            {onMoveBy && messageKeys.moveUp && messageKeys.moveDown && (<>
            <ItemCardAction
              key={'move-up'}
              title={t(messageKeys.moveUp)}
              iconKey="CardMoveUp"
              disabled={!canMoveUp}
              onClick={() => onMoveBy(-1)}
            />
            <ItemCardAction
              key={'move-down'}
              title={t(messageKeys.moveDown)}
              iconKey="CardMoveDown"
              disabled={!canMoveDown}
              onClick={() => onMoveBy(1)}
            />
            <div
              key={'div-after-move-down'}
              style={{
                width: '12px',
              }}
            />
            </>)}
            {canEdit && messageKeys.edit && (
            <ItemCardAction key={'edit'} title={t(messageKeys.edit)} iconKey="CardEdit" onClick={() => onEdit!()} />
            )}
            {onDuplicate && messageKeys.duplicate && (
            <ItemCardAction key={'duplicate'} title={t(messageKeys.duplicate)} iconKey="CardDuplicate" onClick={onDuplicate} />
            )}
            {onDelete && messageKeys.delete && (
            <ItemCardAction key={'delete'} title={t(messageKeys.delete)} iconKey="Delete" onClick={onDelete} />
            )}
          </Box>
        )}
      </Box>

      {Subtitle ? (<>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}/>
        <Subtitle item={item} />
      </>) : subtitle !== null && subtitle !== undefined ? (<>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}/>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
          {subtitle}
        </Typography>
      </>) : null}

      {Body ? <Body item={item} /> : null}
    </Paper>
  );
});

ItemCardImpl.displayName = 'ItemCard';

/**
 * Card chrome for one listed item. See {@link ItemCardProps}.
 *
 * @remarks
 * `memo` erases the item type; this restores it, so a card's `Media`, `Subtitle` and `Body` are typed
 * against the item they are handed.
 */
export const ItemCard = ItemCardImpl as unknown as (<T=any>(props: ItemCardProps<T>) => React.ReactElement) & { displayName?: string };
