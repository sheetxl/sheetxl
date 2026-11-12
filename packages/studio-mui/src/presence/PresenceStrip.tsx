import React, { useEffect, useRef, useState } from 'react';

import { Box, Button, ButtonBase, useTheme } from '@mui/material';

import {
  DEFAULT_ANNOTATION_STYLES, PresenceCommandKeys, PresenceMessages, PRESENCE_PIN_ICON, usePresenceSnapshot,
  type PresenceStore
} from '@sheetxl/react';
import { CommandButtonType, DynamicIcon, useTranslator } from '@sheetxl/utils-react';
import {
  CommandButton, CommandPopupButton, ExhibitIconButton, SimpleTooltip, defaultRenderPopupPanel,
  type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

/** The strip's one height, whatever state it is in — so the toolbar never shifts. */
const STRIP_HEIGHT = 28;
/** The oval around the badge and navigator — inside the strip's height. */
const PILL_HEIGHT = 26;
/** The pill's controls — smaller than the pill, so each circle has room around it. */
const CONTROL_SIZE = 20;
/**
 * The pill's inset, the same on every side — inside its 1px border — so the end controls' rounding
 * is concentric with the pill's ends, open or closed.
 */
const PILL_INSET = (PILL_HEIGHT - 2 - CONTROL_SIZE) / 2;
const CONTROL_ICON = 16;
/** The navigator's and badge's slide. */
const SLIDE = 'max-width 0.25s ease, opacity 0.2s ease';

const PULSE_MS = 1400;
/**
 * A burst of tool calls is one pulse: a call pulses only when the agent has been quiet this long. The
 * pulse says "look", not how much work the agent is doing — and an agent's calls are seconds apart,
 * so a shorter window would still pulse on nearly every one.
 */
const PULSE_QUIET_MS = 3000;
/** The pill's border breathes in the cursor's color while the agent has one up. */
const WORKING_COLOR = DEFAULT_ANNOTATION_STYLES.working.chip;
const WORKING_MS = 1600;
/** How long the hover-expanded navigator stays after the pointer leaves. */
const HOVER_LEAVE_MS = 400;

// The pulse keyframes, injected once (there is no global stylesheet to put them in).
const STYLE_ID = 'sxl-agent-strip-style';
function ensureStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent =
    `@keyframes sxl-agent-pulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.25); opacity: 0; } }\n` +
    `@keyframes sxl-agent-working { 0%, 60% { border-color: ${WORKING_COLOR}; } 30% { border-color: transparent; } }`;
  document.head.appendChild(el);
}

/**
 * The agent button, with the activity pulse: when the agent starts calling tools against this
 * workbook a ring radiates a little way from the button — once per burst (see {@link PULSE_QUIET_MS}).
 * Only a ring — a label sliding out beside it shifted the pill under the user's pointer on every call.
 *
 * @remarks
 * Deliberately no steady "connected" state. The relay has no heartbeat — it only sees requests —
 * so "connected" could only mean "called recently", and it was relay-wide besides. The pulse is
 * per workbook and only ever true. Tool calls are a pulse, never a number.
 */
const AgentButton: React.FC<{ activity: number; children: React.ReactNode }> = ({ activity, children }) => {
  ensureStyle();
  const theme = useTheme();
  // Which pulse is showing (restarts the ring's animation); `0` for none.
  const [pulse, setPulse] = useState(0);
  // No pulse for the value seeded at mount — only for bumps after it.
  const seeded = useRef(activity);
  const lastBumpAt = useRef(0);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activity === seeded.current) return;
    const now = Date.now();
    const quiet = now - lastBumpAt.current > PULSE_QUIET_MS;
    lastBumpAt.current = now;
    if (!quiet) return;
    setPulse(activity);
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => setPulse(0), PULSE_MS);
  }, [activity]);
  useEffect(() => () => { if (endTimer.current) clearTimeout(endTimer.current); }, []);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {pulse ? (
          <span
            key={pulse}
            aria-hidden
            style={{
              // From the button's edge outward — starting inside it drew a ring within the button.
              position: 'absolute', inset: 0, borderRadius: 6, pointerEvents: 'none',
              border: `2px solid ${theme.palette.primary.main}`,
              animation: `sxl-agent-pulse ${PULSE_MS}ms ease-out`,
            }}
          />
        ) : null}
        {children}
      </Box>
    </Box>
  );
};

/**
 * The strip's buttons never take focus: a click must not pull focus (and a focus ring) off the
 * grid. The mouse-down is canceled as Studio's `CommandButton` cancels it, and they are out of the
 * tab order.
 */
const NO_FOCUS = {
  tabIndex: -1,
  onMouseDown: (e: React.MouseEvent): void => { if (e.button === 0) e.preventDefault(); },
  // No ripple either: with no focus to land on, it is left drawn behind the icon after the click.
  disableRipple: true,
} as const;

/**
 * The pill's controls are rounded to match it — unlike the toolbar's square-cornered buttons, which
 * sit on no rounded surface.
 */
const ROUND = {
  width: CONTROL_SIZE,
  height: CONTROL_SIZE,
  padding: 0,
  borderRadius: '50%',
  '& .MuiTouchRipple-child': { borderRadius: '50% !important' }
} as const;
/** The text controls (the position, the count): the same height, a capsule, the digits centered. */
const ROUND_TEXT = { height: CONTROL_SIZE, lineHeight: 1, borderRadius: `${CONTROL_SIZE / 2}px` } as const;

/** A strip button: Studio's dense icon button, with its own tooltip. */
const StripButton: React.FC<{
  title: string;
  iconKey: string;
  onClick: () => void;
  disabled?: boolean;
  /** A toggle's state; leave unset for a plain button. */
  selected?: boolean;
}> = ({ title, iconKey, onClick, disabled, selected }) => (
  <ExhibitIconButton
    dense
    {...NO_FOCUS}
    aria-label={title}
    icon={<DynamicIcon iconKey={iconKey} size={CONTROL_ICON} />}
    propsTooltip={{ label: title }}
    disabled={disabled}
    selected={selected}
    onClick={onClick}
    sx={ROUND}
  />
);

/** A slot that slides between zero width and its content's width, anchored at its right edge. */
const Slide: React.FC<{ open: boolean; max: number; className: string; children: React.ReactNode }> = ({ open, max, className, children }) => (
  <Box
    className={className}
    inert={!open}
    sx={{
      display: 'flex', justifyContent: 'flex-end', overflow: 'hidden', height: PILL_HEIGHT - 2, alignItems: 'center',
      maxWidth: open ? max : 0, opacity: open ? 1 : 0, transition: SLIDE
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: '0 0 auto' }}>{children}</Box>
  </Box>
);

export interface PresenceStripProps {
  store: PresenceStore;
}

/**
 * The agent control for Studio's `topRight` slot. One control, three states:
 *
 * 1. **Quiet** — the agent button only (it pulses on each tool call).
 * 2. **Badge** — the findings' count and, separately, a warning mark when a prompt is waiting on the
 *    user. A prompt never adds to the count, and it does not hide the findings: the prompt sits on
 *    top, it is not modal. While the agent has its `working` cursor up, the pill's border breathes
 *    in the cursor's color and a mark (its label in the tooltip; click to go there) sits in it — the
 *    cursor's only chip: on the grid it is a box alone, and it is never counted.
 * 3. **Expanded** — `x / n`, previous, next, dismiss; slides out to the left. Hovering the badge
 *    expands it while the pointer stays; the pin (or clicking the badge) keeps it open.
 *
 * The agent button at the end is there in every state: its quick action toggles the agent pane,
 * and its menu is the home for the other agent commands.
 */
export const PresenceStrip: React.FC<PresenceStripProps> = ({ store }) => {
  ensureStyle();
  const snapshot = usePresenceSnapshot(store);
  const t = useTranslator();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, navigable, position, needsAttention, working } = snapshot;
  const total = navigable.length;
  // Nothing to walk: the expanded state has nothing to show.
  const showExpanded = total > 0 && (pinned || hovered);
  const pillOpen = showExpanded || total > 0 || needsAttention || !!working;
  useEffect(() => {
    if (total === 0) setPinned(false);
  }, [total]);
  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  // A short grace period on leave, so crossing a gap between controls does not snap it shut.
  const onEnter = (): void => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    setHovered(true);
  };
  const onLeave = (): void => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), HOVER_LEAVE_MS);
  };

  const onBadgeClick = (): void => {
    if (!snapshot.current) store.next();
    setPinned(true);
  };

  const renderPopupPanel = (props: ExhibitPopupPanelProps): React.ReactElement => defaultRenderPopupPanel({
    ...props,
    children: (
      <>
        <CommandButton variant={CommandButtonType.Menuitem} commandKey={PresenceCommandKeys.showPane} />
        <CommandButton variant={CommandButtonType.Menuitem} commandKey={PresenceCommandKeys.clearFindings} />
      </>
    )
  });

  return (
    <Box className="sxl-agent-strip" sx={{ display: 'flex', alignItems: 'center', height: STRIP_HEIGHT, pr: 0.5 }}>
      {/* One oval around the badge and the navigator, in the toolbar's own surface and outline, so the
          count and the walk read as one control in either state. Absent when there is nothing open. */}
      <Box
        className="sxl-agent-pill"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        sx={{
          display: 'flex', alignItems: 'center', height: PILL_HEIGHT, borderRadius: `${PILL_HEIGHT / 2}px`,
          // A round end reads tighter than a straight edge at the same distance: one pixel more at
          // the ends makes the inset LOOK even.
          px: pillOpen ? `${PILL_INSET + 1}px` : 0,
          // Room between the pill and the agent button.
          mr: pillOpen ? 0.75 : 0,
          backgroundColor: pillOpen ? 'var(--sxl-color-elevated, var(--sxl-color-base-100))' : 'transparent',
          border: '1px solid',
          borderColor: pillOpen ? 'var(--sxl-color-elevated-border, transparent)' : 'transparent',
          animation: working ? `sxl-agent-working ${WORKING_MS}ms ease-in-out infinite` : 'none',
          transition: 'padding 0.25s ease, margin 0.25s ease, background-color 0.2s ease, border-color 0.2s ease'
        }}
      >
        <Slide className="sxl-agent-navigator" open={showExpanded} max={180}>
          {/* The position is the way back: scrolled off, it takes the user to the current finding. */}
          <SimpleTooltip disableInteractive title={t(PresenceMessages.goToCurrent)}>
            <Button
              size="small"
              color="inherit"
              {...NO_FOCUS}
              aria-label={t(PresenceMessages.goToCurrent)}
              onClick={() => { if (snapshot.current) store.goTo(snapshot.current.id); else store.next(); }}
              sx={{ ...ROUND_TEXT, minWidth: 36, py: 0, px: 0.5, fontSize: 12, textTransform: 'none', fontVariantNumeric: 'tabular-nums' }}
            >
              {t(PresenceMessages.position, { position: position || '–', total })}
            </Button>
          </SimpleTooltip>
          <StripButton title={t(PresenceMessages.previous)} iconKey="ArrowUpward" onClick={() => store.prev()} />
          <StripButton title={t(PresenceMessages.next)} iconKey="ArrowDownward" onClick={() => store.next()} />
          <StripButton
            title={t(PresenceMessages.dismiss)}
            iconKey="Close"
            disabled={!snapshot.current}
            onClick={() => store.dismissCurrent()}
          />
          <StripButton
            title={pinned ? t(PresenceMessages.unpin) : t(PresenceMessages.pin)}
            iconKey={PRESENCE_PIN_ICON}
            selected={pinned}
            onClick={() => setPinned(!pinned)}
          />
        </Slide>
        {/* The agent's cursor: where it is about to write. Presence, not a finding — never counted. */}
        {/* A presence mark, as a collaborator's avatar is in a shared doc: no button chrome, but a
            click follows it — to where the agent is working. */}
        <Slide className="sxl-agent-working" open={!!working} max={30}>
          <SimpleTooltip
            disableInteractive
            title={working
              ? t(PresenceMessages.working, { where: working.label ? `${working.label} (${working.range})` : working.range })
              : ''}
          >
            <ButtonBase
              {...NO_FOCUS}
              aria-label={t(PresenceMessages.working, { where: working ? working.label ?? working.range : '' })}
              onClick={() => { if (working) store.goTo(working.id); }}
              sx={{ width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: '50%' }}
            >
              <Box
                component="span"
                sx={{
                  // Steady: the pill's border is what breathes.
                  width: 8, height: 8, borderRadius: '50%', backgroundColor: WORKING_COLOR
                }}
              />
            </ButtonBase>
          </SimpleTooltip>
        </Slide>
        {/* Findings: always a count — one finding is "1", not a bare mark. */}
        <Slide className="sxl-agent-badge" open={total > 0 && !showExpanded} max={60}>
          {/* Plain text on the pill — the pill is already the surface. */}
          <Button
            size="small"
            color="inherit"
            {...NO_FOCUS}
            aria-label={t(PresenceMessages.findingsOpen, { count: total })}
            onClick={onBadgeClick}
            sx={{ ...ROUND_TEXT, minWidth: CONTROL_SIZE, py: 0, px: 0.5, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </Button>
        </Slide>
        {/* A pending prompt: a question mark in the warning color, never a number. It needs the user
            now, so it stays put while the navigator is open — but it does not lock the findings out:
            the prompt is on top, not modal. */}
        <Slide className="sxl-agent-attention" open={needsAttention} max={30}>
          {/* An indicator, not an action: a plain icon with its tooltip. */}
          <SimpleTooltip disableInteractive title={t(PresenceMessages.needsAttention)}>
            <Box
              component="span"
              role="img"
              aria-label={t(PresenceMessages.needsAttention)}
              sx={{ display: 'inline-flex', px: 0.5, color: 'warning.main', '& svg': { width: 18, height: 18 } }}
            >
              <DynamicIcon iconKey="Help" />
            </Box>
          </SimpleTooltip>
        </Slide>
      </Box>
      <AgentButton activity={status.activity}>
        <CommandPopupButton
          className="sxl-agent-menu"
          quickCommand={PresenceCommandKeys.showPane}
          renderPopupPanel={renderPopupPanel}
        />
      </AgentButton>
    </Box>
  );
};
