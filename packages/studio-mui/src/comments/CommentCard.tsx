import type React from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import {
  Avatar, Box, Button, IconButton, Menu, Paper, TextField, Typography
} from '@mui/material';
import { type Theme } from '@mui/material';

import { CoordUtils, messageKey, type CellCoords } from '@sheetxl/utils';

import { type IComment, type IPerson, type IWorksheet } from '@sheetxl/sdk';

import {
  tokenVar,
  DynamicIcon, floatThemeScopeProps, useFloatSurface, useLanguage, useNotifier, useTranslator
} from '@sheetxl/utils-react';

import { ExhibitMenuItem, SimpleTooltip } from '@sheetxl/utils-mui';

import { formatCommentTime, getPersonInitials, useCommentThread } from '@sheetxl/react';

const MESSAGE_KEYS = {
  placeholder: messageKey('comment.placeholder'),
  reply: messageKey('comment.reply'),
  post: messageKey('comment.post'),
  save: messageKey('comment.save'),
  cancel: messageKey('comment.cancel'),
  edit: messageKey('comment.edit'),
  delete: messageKey('comment.delete'),
  resolve: messageKey('comment.resolve'),
  reopen: messageKey('comment.reopen'),
  resolved: messageKey('comment.resolved'),
  more: messageKey('comment.more'),
  unknownAuthor: messageKey('comment.unknownAuthor')
} as const;

/**
 * The card's border, by the thread's state: the colors of the cell's indicator, so the card reads
 * as belonging to it.
 */
/** The avatar's diameter and the card's side padding, in px: the overhang is worked out from both. */
const AVATAR_SIZE = 28;
const CARD_PADDING_X = 12;

const ACCENT = {
  thread: tokenVar('color-accent'),
  resolved: tokenVar('color-neutral')
} as const;

export interface CommentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** The sheet the card's cell is on. */
  sheet: IWorksheet;
  /** The cell the card belongs to. */
  coords: CellCoords;
  /** The thread, or `null` for a draft: nothing is written until it is posted. */
  comment: IComment | null;
  /**
   * A new value each time the card's text should take the caret: the draft's field, or the reply
   * box of a thread. `0` or omitted for never.
   */
  focusRequest?: number;
  /** Marks the card as the one for the selected cell. */
  highlighted?: boolean;
  /** Draws the card raised, for one that floats over the grid. */
  elevated?: boolean;
  /**
   * A click on the card's surface, anywhere that is not a control. Omit when there is nothing to
   * select.
   */
  onSelect?: () => void;
  /** The draft was cancelled. */
  onClose?: () => void;
  /** The draft was posted, as this comment. */
  onPosted?: (comment: IComment) => void;
  ref?: React.Ref<HTMLDivElement>;
}

/** What is being edited in place: the thread's own text, or one reply's. */
interface Editing {
  /** The reply's id, or `null` for the thread's own text. */
  replyId: string | null;
}

interface MenuTarget extends Editing {
  anchor: HTMLElement;
}

interface CommentFieldProps {
  initialValue?: string;
  placeholder: string;
  submitLabel: string;
  cancelLabel: string;
  /** Shows the buttons before anything is typed, for a field that was opened on purpose. */
  alwaysShowActions?: boolean;
  onSubmit: (text: string) => void;
  /** Omit for a field with nothing to cancel back to; Escape then only clears what was typed. */
  onCancel?: () => void;
  refInput?: React.Ref<HTMLTextAreaElement>;
}

/**
 * The text field of a card: a comment being started, a reply, or an edit. Ctrl+Enter submits and
 * Escape cancels.
 */
const CommentField = (props: CommentFieldProps) => {
  const {
    initialValue = '', placeholder, submitLabel, cancelLabel, alwaysShowActions = false,
    onSubmit, onCancel, refInput
  } = props;
  const [text, setText] = useState<string>(initialValue);
  const isEmpty = text.trim().length === 0;

  const submit = (): void => {
    if (isEmpty) return;
    onSubmit(text);
    setText('');
  };
  const cancel = (): void => {
    setText('');
    onCancel?.();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <TextField
        className="sxl-comment-field"
        inputRef={refInput}
        value={text}
        placeholder={placeholder}
        multiline
        minRows={1}
        maxRows={8}
        size="small"
        fullWidth
        // A card is not a form: the field is as tall as its text.
        sx={{
          '& .MuiInputBase-root': { padding: '4px 8px', fontSize: '0.875rem', lineHeight: 1.43 }
        }}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value)}
        // The browser's own text menu, not the grid's or the card's.
        onContextMenu={(e: React.MouseEvent) => { e.stopPropagation(); }}
        onKeyDown={(e: React.KeyboardEvent) => {
          // Typing here is not a grid command.
          e.stopPropagation();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape' && (onCancel || !isEmpty)) {
            // Handled here: a card that floats closes on an Escape nobody took.
            e.preventDefault();
            cancel();
          }
        }}
        slotProps={{ htmlInput: { 'aria-label': placeholder, style: { userSelect: 'text' } } }}
      />
      {(alwaysShowActions || !isEmpty) ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.75 }}>
          <Button size="small" onClick={cancel}>{cancelLabel}</Button>
          <Button size="small" variant="contained" disabled={isEmpty} onClick={submit}>{submitLabel}</Button>
        </Box>
      ) : null}
    </Box>
  );
};

interface CommentEntryProps {
  author: IPerson | null;
  date: Date | null;
  content: string;
  /** The entry's text is replaced by this while it is being edited, or written for the first time. */
  editor?: React.ReactNode;
  /** Shown at the end of the header line, before the menu: the thread's cell. */
  trailing?: React.ReactNode;
  /** Hangs the avatar over the card's left edge: the thread's own entry, not its replies. */
  overhang?: boolean;
  /** Omit for an entry with nothing to act on yet. */
  onMenu?: (anchor: HTMLElement) => void;
}

/** One entry of a thread: who, when and what, with its menu. */
const CommentEntry = (props: CommentEntryProps) => {
  const { author, date, content, editor, trailing, overhang = false, onMenu } = props;
  const t = useTranslator();
  const locale = useLanguage();
  const name = author?.getDisplayName() || t(MESSAGE_KEYS.unknownAuthor);
  const time = formatCommentTime(date, { locale });
  return (
    <Box className="sxl-comment-entry" sx={{ display: 'flex', gap: 1, minWidth: 0 }}>
      <Avatar
        aria-hidden
        sx={{
          width: AVATAR_SIZE, height: AVATAR_SIZE, fontSize: '0.75rem',
          bgcolor: 'primary.main', color: 'primary.contrastText',
          // Centered on the card's left border.
          marginLeft: overhang ? `${-(CARD_PADDING_X + AVATAR_SIZE / 2)}px` : undefined
        }}
      >
        {getPersonInitials(name)}
      </Avatar>
      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 28 }}>
          <Typography
            className="sxl-comment-author"
            variant="subtitle2"
            sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {name}
          </Typography>
          <Box sx={{ flex: '1 1 auto' }} />
          {trailing}
          {onMenu ? (
            <SimpleTooltip disableInteractive title={t(MESSAGE_KEYS.more)}>
              <IconButton
                className="sxl-comment-menu"
                size="small"
                aria-label={t(MESSAGE_KEYS.more)}
                aria-haspopup="menu"
                sx={{ padding: '2px', flexShrink: 0 }}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  onMenu(e.currentTarget);
                }}
              >
                <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey="MoreHorizontal" />
              </IconButton>
            </SimpleTooltip>
          ) : null}
        </Box>
        {editor ?? (
          <Typography
            className="sxl-comment-text"
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}
          >
            {content}
          </Typography>
        )}
        {time ? (
          <SimpleTooltip disableInteractive title={time.absolute} placement="bottom-start">
            <Typography
              className="sxl-comment-time"
              variant="caption"
              sx={{ display: 'inline-block', color: 'text.secondary', whiteSpace: 'nowrap', mt: 0.25 }}
            >
              {time.relative}
            </Typography>
          </SimpleTooltip>
        ) : null}
      </Box>
    </Box>
  );
};

/**
 * One threaded comment as a card: each entry's initials, author, time and text, the replies, a
 * reply box, and a menu to edit, resolve or delete. With no comment it is a draft, a field that
 * writes nothing until it is posted.
 *
 * @remarks
 * The same card is listed in the comments task pane and floats beside a cell. Editing an entry's
 * text drops its mentions, as `IComment.setContent` says.
 */
export const CommentCard = memo((props: CommentCardProps) => {
  const {
    sheet,
    coords,
    comment,
    focusRequest = 0,
    highlighted = false,
    elevated = false,
    onSelect,
    onClose,
    onPosted,
    className: propClassName,
    ref,
    ...rest
  } = props;

  const t = useTranslator();
  const notifier = useNotifier();
  const thread = useCommentThread(comment);
  // The menu portals to the document body, outside the studio theme scope: it carries the scope
  // with it, as every float does, or its icons lose their theme colors.
  const menuTheme = floatThemeScopeProps(useFloatSurface()?.themeScope);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const refField = useRef<HTMLTextAreaElement>(null);

  // Asked for by a command: the caret goes to the draft's field, or to the reply box.
  useEffect(() => {
    if (focusRequest) refField.current?.focus();
  }, [focusRequest]);

  /* Every write is the model's own undoable change; a refusal is shown, never thrown at React. */
  const attempt = (write: () => void): void => {
    try {
      write();
    } catch (error: any) {
      notifier.showError?.(error);
    }
  };

  const address = sheet.getRange(CoordUtils.cellToRange(coords)!).getAddress();
  const accent = thread?.resolved ? ACCENT.resolved : ACCENT.thread;
  const isDraft = !comment;
  // Who a draft will be posted as. Asking names the workbook's current person if none was named.
  const draftAuthor = useMemo((): IPerson | null => {
    return isDraft ? sheet.getWorkbook()?.getPeople().getCurrent() ?? null : null;
  }, [isDraft, sheet]);
  // The thread's cell, at the end of the first entry's header line.
  const where = (
    <Typography className="sxl-comment-address" variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
      {address}
    </Typography>
  );
  const isGone = !!thread?.deleted;
  const isResolved = !isGone && !!thread?.resolved;
  // A resolved thread is read, not written: it is reopened or deleted from its header.
  const resolvedHeader = isResolved && comment ? (
    <Box
      className="sxl-comment-resolved-header"
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0,
        pb: 0.75, borderBottom: 1, borderColor: 'divider'
      }}
    >
      <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey="Check" />
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t(MESSAGE_KEYS.resolved)}</Typography>
      <Box sx={{ flex: '1 1 auto' }} />
      <SimpleTooltip disableInteractive title={t(MESSAGE_KEYS.reopen)}>
        <IconButton
          className="sxl-comment-reopen"
          size="small"
          aria-label={t(MESSAGE_KEYS.reopen)}
          sx={{ padding: '2px' }}
          onClick={() => attempt(() => { comment.setResolved(false); })}
        >
          <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey="Undo" />
        </IconButton>
      </SimpleTooltip>
      <SimpleTooltip disableInteractive title={t(MESSAGE_KEYS.delete)}>
        <IconButton
          className="sxl-comment-delete"
          size="small"
          aria-label={t(MESSAGE_KEYS.delete)}
          sx={{ padding: '2px' }}
          onClick={() => attempt(() => { comment.delete(); })}
        >
          <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey="Delete" />
        </IconButton>
      </SimpleTooltip>
    </Box>
  ) : null;
  const menuReply = menu?.replyId ? comment?.getReply(menu.replyId) ?? null : null;

  const renderEditor = (initialValue: string, onSubmit: (text: string) => void): React.ReactNode => (
    <CommentField
      initialValue={initialValue}
      placeholder={t(MESSAGE_KEYS.edit)}
      submitLabel={t(MESSAGE_KEYS.save)}
      cancelLabel={t(MESSAGE_KEYS.cancel)}
      alwaysShowActions
      refInput={(input: HTMLTextAreaElement | null) => { input?.focus(); }}
      onSubmit={(text: string) => {
        attempt(() => onSubmit(text));
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  return (
    <Paper
      ref={ref}
      tabIndex={-1}
      elevation={elevated ? 6 : 0}
      {...rest}
      className={clsx('sxl-comment-card', propClassName, {
        'sxl-comment-draft': isDraft,
        'sxl-comment-resolved': !!thread?.resolved,
        'sxl-comment-highlighted': highlighted
      })}
      data-comment-id={comment?.getId()}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        rest.onClick?.(e);
        if (!onSelect || e.defaultPrevented) return;
        // Controls on the card act for themselves.
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, button, a, [role="button"], [role="menu"], .MuiFormControl-root')) return;
        onSelect();
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: (theme: Theme) => theme.spacing(1),
        boxSizing: 'border-box',
        width: elevated ? 300 : undefined,
        maxWidth: '100%',
        padding: (theme: Theme) => `${theme.spacing(1.25)} ${CARD_PADDING_X}px`,
        border: `1px solid ${accent}`,
        borderRadius: (theme: Theme) => theme.spacing(1.25),
        borderLeft: highlighted ? `4px solid ${accent}` : undefined,
        cursor: onSelect ? 'pointer' : undefined,
        '&:focus-within': {
          outline: `2px solid ${accent}`
        }
      }}
    >
      {isDraft || isGone ? null : (<>
        {resolvedHeader}
        <CommentEntry
          author={thread!.author}
          date={thread!.date}
          content={thread!.content}
          trailing={where}
          overhang
          editor={editing && editing.replyId === null
            ? renderEditor(thread!.content, (text: string) => { comment.setContent(text); })
            : undefined}
          onMenu={isResolved ? undefined : (anchor: HTMLElement) => setMenu({ anchor, replyId: null })}
        />
        {thread!.replies.length > 0 ? (
        // A reply answers the thread, never another reply: one level, set in under the comment.
        <Box className="sxl-comment-replies" sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 2.5, minWidth: 0 }}>
        {thread!.replies.map((reply: IComment.IReply) => (
          <CommentEntry
            key={reply.getId()}
            author={reply.getAuthor()}
            date={reply.getCreationDate()}
            content={reply.getContent()}
            editor={editing?.replyId === reply.getId()
              ? renderEditor(reply.getContent(), (text: string) => { reply.setContent(text); })
              : undefined}
            onMenu={isResolved ? undefined : (anchor: HTMLElement) => setMenu({ anchor, replyId: reply.getId() })}
          />
        ))}
        </Box>
        ) : null}
      </>)}

      {isDraft ? (
        <CommentEntry
          author={draftAuthor}
          date={null}
          content=""
          trailing={where}
          overhang
          editor={(
            <CommentField
              placeholder={t(MESSAGE_KEYS.placeholder)}
              submitLabel={t(MESSAGE_KEYS.post)}
              cancelLabel={t(MESSAGE_KEYS.cancel)}
              alwaysShowActions
              refInput={refField}
              onSubmit={(text: string) => {
                attempt(() => {
                  const posted = sheet.getComments().add(CoordUtils.cellToRange(coords)!, text);
                  onPosted?.(posted);
                });
              }}
              onCancel={onClose}
            />
          )}
        />
      ) : isGone || isResolved ? null : (
        <CommentField
          placeholder={t(MESSAGE_KEYS.reply)}
          submitLabel={t(MESSAGE_KEYS.post)}
          cancelLabel={t(MESSAGE_KEYS.cancel)}
          refInput={refField}
          onSubmit={(text: string) => attempt(() => { comment.addReply(text); })}
        />
      )}

      {menu && comment ? (
        <Menu
          open
          anchorEl={menu.anchor}
          className={menuTheme.className}
          {...menuTheme.attrs}
          onClose={() => setMenu(null)}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); }}
        >
          <ExhibitMenuItem
            icon={<DynamicIcon iconKey="CardEdit" />}
            onClick={() => {
              setEditing({ replyId: menu.replyId });
              setMenu(null);
            }}
          >
            {t(MESSAGE_KEYS.edit)}
          </ExhibitMenuItem>
          {menu.replyId === null ? (
            <ExhibitMenuItem
              icon={<DynamicIcon iconKey={thread?.resolved ? 'Undo' : 'Check'} />}
              onClick={() => {
                attempt(() => { comment.setResolved(!comment.isResolved()); });
                setMenu(null);
              }}
            >
              {thread?.resolved ? t(MESSAGE_KEYS.reopen) : t(MESSAGE_KEYS.resolve)}
            </ExhibitMenuItem>
          ) : null}
          <ExhibitMenuItem
            icon={<DynamicIcon iconKey="Delete" />}
            onClick={() => {
              attempt(() => {
                if (menu.replyId === null) comment.delete();
                else menuReply?.delete();
              });
              setMenu(null);
            }}
          >
            {t(MESSAGE_KEYS.delete)}
          </ExhibitMenuItem>
        </Menu>
      ) : null}
    </Paper>
  );
});

CommentCard.displayName = 'CommentCard';
