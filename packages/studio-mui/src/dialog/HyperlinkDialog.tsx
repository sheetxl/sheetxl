import type React from 'react';
import { useState, useMemo, useEffect, useRef, memo, useId } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select, type SelectChangeEvent } from '@mui/material';
import { TextField } from '@mui/material';

import { type ICalculation, type ICell, type IHyperlink } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { useReferenceMode, type FormulaInputApi } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { FormulaField, InputField } from '../form';

/**
 * Input payload for the hyperlink dialog: modifier properties (where `address`/`textToDisplay`
 * may be `null` to signal a clear) or a shorthand `string`.
 */
export type HyperlinkDialogInput = (Omit<IHyperlink.Modifiers, 'address' | 'textToDisplay'> & {
  address?: string | null;
  textToDisplay?: string | null;
}) | string;

export interface HyperlinkDialogProps extends InputDialogProps<HyperlinkDialogInput, ICell> {
  /**
   * Shows the link without letting it change: the fields are disabled and the only button is Cancel.
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * Leaves out the display text, for a link on something with no text of its own: a picture.
   * @defaultValue false
   */
  hideDisplayText?: boolean;
  /**
   * The sheet the link lives on, when there is no cell in `context` to tell: what a bare `A1` resolves
   * against.
   */
  sheetName?: string;
};


const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];
const DISABLED_INPUT_OPTIONS = ['Cancel'];

/**
 * Clearance above the address row. Neither field widget reserves room for its FLOATING label (they share
 * one set of metrics so swapping the link type never shifts the dialog), so the host states it — and states
 * it on BOTH branches, since the one that reserved less would be the one that shifts. Matches the display-
 * text row below, which adds the same step for the same reason.
 */
const FIELD_CLEARANCE = { paddingTop: (theme: Theme) => theme.spacing(1.5) };

/**
 * Where a link points — a url, a location within this workbook, or an email address. All are
 * folded into the single `IHyperlink` address: a leading `#` marks the in-document form (see
 * `IHyperlink.getAddress`) and a `mailto:` scheme the email form; this dialog unfolds them into
 * a picked type + the matching inputs.
 *
 * The email type is Excel's "E-mail Address" pane — an opt-in for the subject, since the SDK
 * links a bare email typed into the address box (or a cell) as `mailto:` on its own.
 */
type LinkType = 'url' | 'document' | 'email';

/** The cell's hyperlink when it can be edited; a read-only one (a cell's `HYPERLINK()` value) is not. */
const _setHyperlink = (hyperlink: IHyperlink | null | undefined): IHyperlink | null | undefined =>
  hyperlink?.isReadOnly() ? null : hyperlink;

const MAILTO = 'mailto:';
const isMailto = (address: string): boolean =>
  address.length >= MAILTO.length && address.substring(0, MAILTO.length).toLowerCase() === MAILTO;

/**
 * Unfold `mailto:addr?subject=…` into the email pane's two boxes, or `null` for a non-email address.
 * Only `subject` is surfaced (as in Excel); any other query parameter is dropped on re-fold.
 */
const unfoldMailto = (address: string): { address: string; subject: string } | null => {
  if (!isMailto(address)) return null;
  const rest = address.substring(MAILTO.length);
  const indexQuery = rest.indexOf('?');
  if (indexQuery === -1) return { address: rest, subject: '' };
  let subject = '';
  try {
    subject = new URLSearchParams(rest.substring(indexQuery + 1)).get('subject') ?? '';
  } catch {
    // an unparsable query - the subject box starts empty
  }
  return { address: rest.substring(0, indexQuery), subject };
};

/**
 * Fold the email pane back into a stored address — Excel's shape, `mailto:addr?subject=Hello%20there`.
 * A pasted `mailto:` prefix is tolerated; an empty address is no link (`null`).
 */
const foldMailto = (address: string, subject: string): string | null => {
  let trimmed = address.trim();
  if (isMailto(trimmed)) trimmed = trimmed.substring(MAILTO.length);
  if (!trimmed) return null;
  const subjectTrimmed = subject.trim();
  return `${MAILTO}${trimmed}${subjectTrimmed ? `?subject=${encodeURIComponent(subjectTrimmed)}` : ''}`;
};

/**
 * Hover should include (a goto with fun icon, copy, edit, and remove)
 *
 * ZOHO has a decent insert hyperlink dialog.
 * Excel online does this as a radio option (url, sheetReference, or email) (would later like to include links to people or any object?)
 * Google sheets has a little world icon for url, we could have a sheet icon for sheet reference.
 *
 * * validate and read url to determine the display name (from fetch?)
 * * Support for remove
 * * ui to show insert or remove
 * * Excel also allows for tooltip (screenTip)
 */
export const HyperlinkDialog: React.FC<HyperlinkDialogProps> = memo((props) => {
  const {
    initialValue = null,
    context,
    onInput,
    onOption,
    onValidateOption,
    onDone,
    disabled = false,
    hideDisplayText = false,
    sheetName: propSheetName,
    options = disabled ? DISABLED_INPUT_OPTIONS : DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  const isEdit = useMemo(() => {
    return (initialValue ?? _setHyperlink(context?.()?.getHyperlink()) ?? null) !== null;
  }, []);

  const hyperlink = useMemo((): { address: string; textToDisplay: string } => {
    let initialHyperlinkModifiers: (Omit<IHyperlink.Modifiers, 'address' | 'textToDisplay'> & {
      address?: string | null;
      textToDisplay?: string | null;
    }) | null = null;
    let initialHyperlinkString: string | null = null;
    if (initialValue) {
      if (typeof initialValue === 'string') {
        initialHyperlinkString = initialValue;
      } else {
        initialHyperlinkModifiers = initialValue;
      }
    }
    const iHyperlink: IHyperlink | null | undefined = initialHyperlinkModifiers ? null : _setHyperlink(context?.()?.getHyperlink());
    let retValue = {
      address: initialHyperlinkString ?? initialHyperlinkModifiers?.address ?? iHyperlink?.getAddress() ?? '',
      textToDisplay: initialHyperlinkModifiers?.textToDisplay ?? iHyperlink?.getTextToDisplay() ?? ''
    }
    return retValue;
  }, [initialValue, context]);

  const isDocumentLink = hyperlink.address.startsWith('#');
  const initialEmail = useMemo(() => unfoldMailto(hyperlink.address), [hyperlink.address]);
  const [linkType, setLinkType] = useState<LinkType>(isDocumentLink ? 'document' : initialEmail ? 'email' : 'url');

  const [webAddress, setWebAddress] = useState<string>(isDocumentLink || initialEmail ? '' : hyperlink.address);
  const [emailAddress, setEmailAddress] = useState<string>(initialEmail?.address ?? '');
  const [emailSubject, setEmailSubject] = useState<string>(initialEmail?.subject ?? '');
  // The reference field's committed value — the initial location TEXT (the address minus its `#`),
  // replaced by the field's parsed formula as the user types/picks. Left untouched it round-trips
  // verbatim, so a location the grammar can't re-parse (a renamed sheet) survives an Ok.
  const [docValue, setDocValue] = useState<ICalculation.IFormula | string | null>(
    () => isDocumentLink ? (hyperlink.address.substring(1) || null) : null
  );
  // The raw TEXT of the reference field (invalid states included) — only for the display-text
  // placeholder; the committed address comes from `docValue`.
  const [docText, setDocText] = useState<string>(isDocumentLink ? hyperlink.address.substring(1) : '');
  const [docError, setDocError] = useState<string | null>(null);

  const [textToDisplay, setTextToDisplay] = useState<string>(() => {
    // if no address we treat the display as an input value;
    const initialValue = context?.().getText({ useFormattingCategory: true }) ?? hyperlink.textToDisplay;
    // If the displayValue is the same as the address then we don't want to show it as it was the default.
    // (For an email link the default is the bare address — what typing the email into a cell shows.)
    if (initialValue === hyperlink.address || (initialEmail && initialValue === initialEmail.address))
      return '';
    return initialValue;
  });
  // TODO - add support for tooltip editing

  const [firstFocus, setFirstFocus] = useState<boolean>(false);
  const idLinkTo = useId();

  // Switching the link type moves focus into the revealed input (matters because a click outside
  // the dialog closes it — the user must be able to go straight from the dropdown to typing, or to
  // picking on the grid, which needs the reference field focused to arm reference mode). Two
  // hand-offs: immediately on the type change (the effect below), and again when the menu's exit
  // transition ends (`onExited` on the Select's menu) — the menu is a live focus trap until it is
  // gone, so an early hand-off can be stolen back (which also DISARMS the field); the exit one is
  // the deterministic last word, and the only one that fires when the CURRENT type is re-picked
  // (no state changes). The menu's own focus restore is disabled (see the Select) so it can't
  // steal the focus back either.
  const refFields = useRef<HTMLDivElement>(null);
  const refDocApi = useRef<FormulaInputApi>(null);
  const focusRevealedInput = useCallbackRef(() => {
    refFields.current?.querySelector<HTMLInputElement>('input.autoFocus')?.focus();
    // Engaging is what ARMS picking, and the focus above only engages through its focus EVENT —
    // which a hand-off racing the menu's own focus work may never fire (observed: field focused,
    // caret blinking, not armed until the first keystroke). Engage explicitly as well; idempotent,
    // and null for the url field (a plain input — nothing to arm).
    refDocApi.current?.engage();
  }, []);
  const refLastLinkType = useRef<LinkType>(linkType);
  useEffect(() => {
    if (refLastLinkType.current === linkType) return;
    refLastLinkType.current = linkType;
    focusRevealedInput();
  }, [linkType]);

  // The field's anchor: the cell the link is attached to, so a bare `A1` resolves against (and
  // displays bare for) the sheet the link lives on — which is also how the opener resolves an
  // unqualified location at click time.
  const home = useMemo(() => {
    const sheetName = propSheetName ?? context?.()?.getWorksheet()?.getName();
    return sheetName ? { scope: sheetName } : undefined;
  }, [context, propSheetName]);

  // The Excel "RefEdit" behavior: while the field is PICKING (reference point mode on the bus), the
  // dialog suspends its modality so grid/header clicks reach the sheet; done (Enter/Escape/toggle)
  // restores it. (The field's workbook comes from `WorkbookProvider`, which wraps the modal host.)
  const referenceMode = useReferenceMode();
  const picking = referenceMode.getMode()?.mode === 'point';

  const handleOnDisplayChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextToDisplay(e.target.value);
  }, []);

  // Fold the picked type + input back into the single stored address (`#` marks in-document).
  // A parsed reference serializes through `getReferences()` — workbook-scoped, so the location is
  // sheet-qualified and still lands when the link is followed from another sheet.
  const resolveAddress = useCallbackRef((): string | null => {
    if (linkType === 'document') {
      if (typeof docValue === 'string') {
        const text = docValue.trim();
        return text ? `#${text}` : null;
      }
      const address = docValue?.getReferences()?.getAddress();
      return address ? `#${address}` : null;
    }
    if (linkType === 'email') {
      return foldMailto(emailAddress, emailSubject);
    }
    return webAddress === '' ? null : webAddress;
  }, [linkType, docValue, webAddress, emailAddress, emailSubject]);

  const handleHyperlink = useCallbackRef(async (option: OptionInput) => {
    const isCancel = option === cancelOption;
    if (!isCancel) {
      const address = resolveAddress();
      // The default text is the destination as a person would write it: the location without its
      // `#`, the email without its `mailto:` (and subject) — the same text typing it into a cell keeps.
      let defaultDisplay: string | null = address;
      if (address?.startsWith('#')) defaultDisplay = address.substring(1);
      else if (linkType === 'email' && address) defaultDisplay = unfoldMailto(address)?.address ?? address;
      onInput?.({
        address,
        // An empty display box means "use the address" — the same default the field itself
        // hides when the cell's text already matches it. Sending it blank would set a link on
        // a cell with nothing to show, which reads as a cell where nothing happened.
        textToDisplay: (textToDisplay === '' ? defaultDisplay : textToDisplay) ?? null
      });
    }
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.();
  }, [resolveAddress, linkType, textToDisplay, onInput, onDone, onOption, defaultOption, cancelOption]);

  const handleValidateOptions = useCallbackRef(async (option?: OptionInput): Promise<boolean> => {
    const result: boolean | null | undefined = await Promise.resolve(onValidateOption?.(option));
    if (result === false) return false;
    // An in-document location that doesn't parse never commits — the field is showing why.
    if (linkType === 'document' && docError) return false;
    return true;
  }, [onValidateOption, linkType, docError]);

  const placeholderDisplay = linkType === 'document' ? docText : linkType === 'email' ? emailAddress : webAddress;

  return (
    <OptionsDialog
      title={isEdit ? t('hyperlink.titleEdit') : t('hyperlink.titleInsert')}
      options={options}
      onDone={onDone}
      onOption={(option: OptionInput) => handleHyperlink(option) }
      onValidateOption={handleValidateOptions}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      // A disabled field cannot take focus, and Escape only reaches the dialog from inside it.
      autoFocusSel={disabled ? '.defaultOption' : '.autoFocus'}
      suspendModal={picking}
      sx={{
        width: '480px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        ref={refFields}
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0), // helper text spacing is already applied
          rowGap: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <FormControl
          sx={{
            minWidth: 135, // TODO - make this dynamic
            width: '100%'
          }}
          size="small"
        >
          <InputLabel id={idLinkTo}>
            {t('hyperlink.linkTo')}
          </InputLabel>
          <Select
            labelId={idLinkTo}
            value={linkType}
            disabled={disabled}
            label={t('hyperlink.linkTo')}
            MenuProps={{
              // No focus restore on close — the hand-offs above move focus into the revealed input,
              // and the restore (which fires after the menu's exit transition) would steal it back.
              disableRestoreFocus: true,
              // The guaranteed hand-off (see `focusRevealedInput`): only after the exit transition
              // is the menu's focus trap really gone, so a focus taken here STAYS — and the field
              // arms reference mode on receiving it.
              slotProps: { transition: { onExited: focusRevealedInput } },
              // Restates the theme's `MuiSelect` default, which this MenuProps object replaces.
              container: () => document.fullscreenElement
            }}
            onChange={(e: SelectChangeEvent<LinkType>) => {
              setLinkType(e.target.value as LinkType);
            }}
          >
            <MenuItem value="url">{t('hyperlink.typeWebPage')}</MenuItem>
            <MenuItem value="document">{t('hyperlink.typeInDocument')}</MenuItem>
            <MenuItem value="email">{t('hyperlink.typeEmail')}</MenuItem>
          </Select>
        </FormControl>
        {linkType === 'email' ? (
          // Excel's "E-mail Address" pane: the address and an optional subject. Both are
          // `InputField`s so the row keeps the same metrics as the other two types (see the
          // url branch below); the address comes first so it takes the `.autoFocus` hand-off.
          <>
            <InputField
              sx={FIELD_CLEARANCE}
              label={t('hyperlink.emailAddress')}
              defaultInput={t('hyperlink.emailPlaceholder')}
              value={emailAddress}
              disabled={disabled}
              onChangeInput={(value: string) => setEmailAddress(value)}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                if (!firstFocus) {
                  e.target?.select?.();
                }
                setFirstFocus(true);
              }}
            />
            <InputField
              label={t('hyperlink.subject')}
              defaultInput={''}
              value={emailSubject}
              disabled={disabled}
              onChangeInput={(value: string) => setEmailSubject(value)}
              onFocus={() => setFirstFocus(true)}
            />
          </>
        ) : linkType === 'document' ? (
          <FormulaField
            sx={FIELD_CLEARANCE}
            grammar="reference"
            apiRef={refDocApi}
            classNameInput={'autoFocus'}
            label={t('hyperlink.reference')}
            value={docValue}
            disabled={disabled}
            allowMulti={false}
            home={home}
            onChangeInput={(value: ICalculation.IFormula | null) => setDocValue(value)}
            onChangeText={(text: string) => setDocText(text)}
            onChangeError={(error: string | null) => setDocError(error)}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
              if (!firstFocus) {
                e.target?.select?.();
              }
              setFirstFocus(true);
            }}
          />
        ) : (
          // `InputField`, not a raw TextField — the FormulaField's plain sibling shares its metrics
          // (reserved helper line included), so flipping the link type never shifts the fields below.
          <InputField
            sx={FIELD_CLEARANCE}
            label={t('hyperlink.address')}
            defaultInput={t('hyperlink.addressPlaceholder')}
            value={webAddress}
            disabled={disabled}
            onChangeInput={(value: string) => setWebAddress(value)}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
              if (!firstFocus) {
                e.target?.select?.();
              }
              setFirstFocus(true);
            }}
          />
        )}
        {hideDisplayText ? null : <FormControl
          sx={{
            paddingTop: (theme: Theme) => theme.spacing(1.5),
            minWidth: 135, // TODO - make this dynamic
            width: '100%'
          }}
          size="small"
        >
        <TextField
          label={t('hyperlink.displayText')}
          placeholder={placeholderDisplay}
          onFocus={() => {
            setFirstFocus(true);
          }}
          sx={{
            '& .MuiFormHelperText-root': {
              marginTop: (theme: Theme) => theme.spacing(0.5)
            }
          }}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
            htmlInput: {
              spellCheck: false,
              autoComplete: "off",
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1.25),
                paddingBottom: (theme: Theme) => theme.spacing(0.75)
              }
            }
          }}
          value={textToDisplay}
          disabled={disabled}
          onChange={handleOnDisplayChange}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>}
      </Box>
    </OptionsDialog>
  );
});

export default HyperlinkDialog;
