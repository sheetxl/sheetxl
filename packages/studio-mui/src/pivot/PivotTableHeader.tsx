import type React from 'react';
import { useMemo } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { ExpectedError } from '@sheetxl/utils';

import { type ICalculation } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { type PivotTableHeaderProps, type ReferenceDoneArgs, type EditDoneArgs } from '@sheetxl/react';

import { FormulaField, InputField } from '../form';

import { pivotSourceOf } from './_pivotSource';

/**
 * The PivotTable Fields pane's header in the studio: the table's name and its source, each edited
 * in place and changed on commit (Enter, blur or ✓), as Table Details edits a table's.
 *
 * @remarks
 * Both are read-only on a locked sheet, where Excel refuses a refresh; the source is read-only too
 * when the table's cache names none this workbook holds (an external or data model source).
 */
export const PivotTableHeader = (props: PivotTableHeaderProps): React.ReactElement => {
  const { pivot, name, source, onError } = props;

  const t = useTranslator();
  const sheet = pivot.getWorksheet();
  const locked = sheet.getProtection().isLocked();

  // Bare text in the source resolves on the table's own sheet.
  const home = useMemo(() => ({ scope: sheet.getName() }), [sheet]);

  const handleNameDone = useCallbackRef((text: string, args: EditDoneArgs) => {
    if (args.reason !== 'accept' || text === pivot.getName()) return;
    pivot.setName(text).catch(onError);
  }, [pivot, onError]);

  const validateName = useCallbackRef((text: string): void => {
    if (text.length === 0 || text.length > 255) throw new ExpectedError(t('error.pivotTable.nameInvalid'));
    const other = sheet.getPivotTables().getByName(text);
    if (other && other.getName() !== pivot.getName()) throw new ExpectedError(t('error.pivotTable.nameExists'));
  }, [sheet, pivot, t]);

  const handleSourceDone = useCallbackRef((value: ICalculation.IFormula | null, args: ReferenceDoneArgs) => {
    if (args.reason !== 'accept') return;
    const next = pivotSourceOf(value);
    if (!next) return;
    pivot.setSource(typeof next === 'string' ? next : next.at(0)).catch(onError);
  }, [pivot, onError]);

  return (
    <Box
      className="sxl-pivot-table-header"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Clearance for the next field's floating label; the helper line alone leaves it touching.
        rowGap: (theme: Theme) => theme.spacing(1),
        paddingTop: (theme: Theme) => theme.spacing(1)
      }}
    >
      <InputField
        formName={'name'}
        value={name}
        changeOn="done"
        onDone={handleNameDone}
        onValidate={validateName}
        disabled={locked}
      />
      <FormulaField
        grammar="reference"
        formName={'source'}
        label={t('pivotTableNew.source')}
        value={source}
        allowMulti={false}
        home={home}
        pickAs="absolute"
        changeOn="done"
        onDone={handleSourceDone}
        disabled={locked || source === null}
      />
    </Box>
  );
};
