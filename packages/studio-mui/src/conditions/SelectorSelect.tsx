import { memo } from 'react';

import {
  FormControl, Select, MenuItem, InputLabel, type FormControlProps, type SxProps, type Theme
} from '@mui/material';

import { type ICondition } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

export interface SelectorSelectProps extends Omit<FormControlProps, 'onChange' | 'children'> {
  /**
   * The list of selectors to choose from.
   */
  selectors: ICondition.ISelector[];
  /**
   * Current selected type. Null represents "Any".
   */
  value: ICondition.ISelector | null;
  /**
   * Callback fired when the type changes. An extra row chosen comes as `extra`, with no selector.
   */
  onChange: (selector: ICondition.ISelector | null, extra?: string) => void;
  /**
   * Rows after the selectors that are not selectors: the host's own entries, named by value.
   * A Formula rule is one: the formula stands in for the cell's value,
   * which is a reading, so it is listed where the readings are.
   */
  extras?: readonly { value: string; title: string }[];
  /** The extra row currently chosen, by value; `value` is then ignored. */
  extraValue?: string | null;
  /**
   * Optional title for the select input. If not provided.
   *
   * @default 'Condition'.
   */
  title?: string;
  /**
   * If true, allows selecting a null value (representing "Any" or no specific selector).
   */
  allowNull?: boolean;
  /**
   * If true, the select is readonly (not editable, but not visually disabled).
   *
   * @remarks
   * Uses `readOnly` on the Select to prevent opening the dropdown while
   * maintaining consistent sizing and non-disabled appearance.
   */
  readOnly?: boolean;
}

/**
 * Select component for choosing a selector (Number, Text, Date, Display, etc.): how the
 * condition reads a value. The rows are selectors and nothing else; a test that looks like a
 * type to an Excel user ("List") is an operator under Any.
 */
export const SelectorSelect = memo<SelectorSelectProps>((props) => {
  const {
    value = null,
    selectors,
    onChange,
    title: propTitle,
    allowNull = false,
    readOnly = false,
    extras,
    extraValue = null,
    ...rest
  } = props;

  const t = useTranslator();
  const title = propTitle ?? t('condition.selectorTitle');

  const rows: { value: string, title: string }[] = selectors.map((selector) => ({
    value: selector.getName(),
    title: selector.getTitle?.() ?? selector.getName()
  }));
  const menuElements = rows.map((row) => (
    <MenuItem key={row.value} value={row.value}>
      {row.title}
    </MenuItem>
  ));
  const extraElements = (extras ?? []).map((row) => (
    <MenuItem key={`extra:${row.value}`} value={row.value}>
      {row.title}
    </MenuItem>
  ));

  let selectSx: SxProps<Theme> = {
    backgroundColor: 'background.paper'
  }
  if (readOnly) {
    selectSx = {
      ...selectSx,
      '& .MuiSelect-icon': {
        display: 'none' // Hide dropdown arrow when readonly
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'action.disabled' // Subtle visual cue
      },
    }
  }

  return (
    <FormControl
      size="small" {...rest}
    >
      <InputLabel>{title}</InputLabel>
      <Select
        value={extraValue ?? value?.getName() ?? 'null'}
        label={title}
        readOnly={readOnly}
        IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
        onChange={(e) => {
          const selectedValue = e.target.value as string;
          if (extras?.some((row) => row.value === selectedValue)) {
            onChange(null, selectedValue);
            return;
          }
          const newSelector = selectedValue === 'null' ? null : selectors.find(selector => selector.getName() === selectedValue) ?? null;
          onChange(newSelector);
        }}
        sx={selectSx}
      >
        {allowNull && <MenuItem value='null'>{t('condition.anySelector')}</MenuItem>}
        {menuElements}
        {extraElements}
      </Select>
    </FormControl>
  );
});

SelectorSelect.displayName = 'SelectorSelect';