import type React from 'react';
import { memo } from 'react';

import {
  Box, FormControl, Select, MenuItem, ListSubheader, Divider, type BoxProps
} from '@mui/material';

import { ICondition } from '@sheetxl/sdk';
import { DynamicIcon, useTranslator, useLanguage, type TranslateFn } from '@sheetxl/utils-react';

import { SxListSubheader, SxMenuItem } from './ConditionUtils';

export interface TimePeriodOptionProps extends BoxProps {
  /**
   * The time period option to edit.
   */
  option: ICondition.TimePeriodOption;

  /**
   * The callback function to handle changes in the time period option.
   */
  onOptionChange: (option: ICondition.TimePeriodOption) => void;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Time period options organized with ListSubHeaders and dividers. Built per language:
 * month names come from `Intl.DateTimeFormat` (free for every locale, no catalog entries),
 * everything else through `t()`.
 */
function timePeriodGroups(t: TranslateFn, language: string) {
  const monthName = (month: number): string =>
    new Intl.DateTimeFormat(language, { month: 'long' }).format(new Date(2000, month, 1));
  return [
    {
      header: t('condition.period.day'),
      options: [
        { value: ICondition.TimePeriodType.Today, label: t('condition.period.today') },
        { value: ICondition.TimePeriodType.Yesterday, label: t('condition.period.yesterday') },
        { value: ICondition.TimePeriodType.Tomorrow, label: t('condition.period.tomorrow') }
      ]
    },
    {
      header: t('condition.period.week'),
      options: [
        { value: ICondition.TimePeriodType.ThisWeek, label: t('condition.period.thisWeek') },
        { value: ICondition.TimePeriodType.LastWeek, label: t('condition.period.lastWeek') },
        { value: ICondition.TimePeriodType.NextWeek, label: t('condition.period.nextWeek') }
      ]
    },
    {
      header: t('condition.period.month'),
      options: [
        { value: ICondition.TimePeriodType.ThisMonth, label: t('condition.period.thisMonth') },
        { value: ICondition.TimePeriodType.LastMonth, label: t('condition.period.lastMonth') },
        { value: ICondition.TimePeriodType.NextMonth, label: t('condition.period.nextMonth') },
      ]
    },
    {
      header: t('condition.period.year'),
      options: [
        { value: ICondition.TimePeriodType.YearToDate, label: t('condition.period.yearToDate') },
        { value: ICondition.TimePeriodType.LastYear, label: t('condition.period.lastYear') }
        // no next year
      ]
    },
    {
      header: t('condition.period.byMonth'),
      options: [
        { value: ICondition.TimePeriodType.M1, label: monthName(0) },
        { value: ICondition.TimePeriodType.M2, label: monthName(1) },
        { value: ICondition.TimePeriodType.M3, label: monthName(2) },
        { value: ICondition.TimePeriodType.M4, label: monthName(3) },
        { value: ICondition.TimePeriodType.M5, label: monthName(4) },
        { value: ICondition.TimePeriodType.M6, label: monthName(5) },
        { value: ICondition.TimePeriodType.M7, label: monthName(6) },
        { value: ICondition.TimePeriodType.M8, label: monthName(7) },
        { value: ICondition.TimePeriodType.M9, label: monthName(8) },
        { value: ICondition.TimePeriodType.M10, label: monthName(9) },
        { value: ICondition.TimePeriodType.M11, label: monthName(10) },
        { value: ICondition.TimePeriodType.M12, label: monthName(11) }
      ]
    },
    {
      header: t('condition.period.byQuarter'),
      options: [
        { value: ICondition.TimePeriodType.ThisQuarter, label: t('condition.period.thisQuarter') },
        { value: ICondition.TimePeriodType.LastQuarter, label: t('condition.period.lastQuarter') },
        { value: ICondition.TimePeriodType.NextQuarter, label: t('condition.period.nextQuarter') },
        { value: ICondition.TimePeriodType.Q1, label: t('condition.period.q1') },
        { value: ICondition.TimePeriodType.Q2, label: t('condition.period.q2') },
        { value: ICondition.TimePeriodType.Q3, label: t('condition.period.q3') },
        { value: ICondition.TimePeriodType.Q4, label: t('condition.period.q4') }
      ]
    }
  ];
}

/**
 * Component for editing time period option (date period selector).
 *
 * @remarks
 * Allows selecting relative date periods like "today", "last week", "this month", etc.
 */
export const TimePeriodOption = memo<TimePeriodOptionProps>((props) => {
  const { option, onOptionChange, readOnly, ...rest } = props;

  const t = useTranslator();
  const language = useLanguage();
  const groups = timePeriodGroups(t, language);
  const type = option?.type ?? ICondition.TimePeriodType.Today;

  return (
    <Box
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...rest?.sx
      }}
    >
      <FormControl
        size="small"
      >
        <Select
          value={type}
          sx={{ backgroundColor: 'background.paper' }}
          IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
          onChange={(e) => {
            // Another period is evaluated afresh: the day the last one was evaluated on does not carry.
            const { anchorDate: _anchorDate, ...rest } = option ?? {};
            onOptionChange({ ...rest, type: e.target.value as ICondition.TimePeriodType });
          }}
          disabled={readOnly}
        >
          {groups.map((group, groupIndex) => {
            const items = []
            if (groupIndex > 0) items.push(<Divider key={`divider-${groupIndex}`} />);
            items.push(
              <ListSubheader
                key={`header-${groupIndex}`}
                sx={SxListSubheader}
              >
                {group.header}
              </ListSubheader>
            );
            group.options.map((option: any) => (
              items.push(
                <MenuItem
                  sx={SxMenuItem}
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>
                )
              )
            );
            return items;
          })}
        </Select>
      </FormControl>
    </Box>
  );
});

TimePeriodOption.displayName = 'TimePeriodOption';