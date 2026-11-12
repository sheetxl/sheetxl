import React, { useState, memo, useMemo } from 'react';
import { type Theme } from '@mui/material';

import { Box } from '@mui/material';
import { Link } from '@mui/material';
import { IconButton } from '@mui/material';
import { FormControl, type FormControlProps } from '@mui/material';
import { FormHelperText } from '@mui/material';

import { type IWorkbook, type ICellRange } from '@sheetxl/sdk';

import { DynamicIcon } from '@sheetxl/utils-react';

import { type IWorkbookElement, useRangeListener } from '@sheetxl/react';

export interface BoundedWidgetElementProps extends FormControlProps {
  /** The bound range; `null` until a cell is linked. */
  range: ICellRange | null;
  refIWorkbookElement: React.RefObject<IWorkbookElement | null>;
}

export interface BoundedWidgetProps extends FormControlProps {
  workbook: IWorkbook | null;
  refIWorkbookElement: React.RefObject<IWorkbookElement | null>;
  initialAddress?: string;

  createWidget(props: BoundedWidgetElementProps): React.ReactElement;
}

/**
 * 2-way binding between a widget (children) and a cell range.
 */
export const BoundedWidget = memo((props: BoundedWidgetProps) => {
  const {
    initialAddress: _initialAddress,
    createWidget,
    workbook,
    refIWorkbookElement,
    ...rest
  } = props;

  const [address, setAddress] = useState<string | null>(null);
  const [range, setRange] = useState<ICellRange | null>(null);

  useRangeListener(workbook, address, (event: ICellRange.Event) => {
    setRange(event.getSource());
  });

  const widget = useMemo(() => {
    return createWidget({
      range, refIWorkbookElement
    });
  }, [range, createWidget, refIWorkbookElement]);

  return (
    <FormControl
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          rowGap: (theme: Theme) => theme.spacing(0.25),
        }}
      >
        {widget}
        <IconButton
          sx={{my: -2}}
          disabled={!workbook}
          onClick={() => {
            // act-like a toggle link the the currently selected cell
            setAddress(address === null ? workbook?.getSelectedCell().getAddress() ?? null : null);
          }}
        >
          <DynamicIcon iconKey='ExternalLinked'/>
        </IconButton>
      </Box>
      <FormHelperText>
        <Link
          component="button"
          underline="hover"
          variant="body2"
          disabled={range?.isInvalid()}
          sx={{
            "&:not(:hover)": {
              color: "inherit"
            },
            "&[disabled]": {
              color: (theme: Theme) => {
                return theme.palette.text.disabled;
              },
              cursor: "default",
              "&:hover": {
                textDecoration: "none"
              }
            }
          }}
          onClick={() => {
            range?.select();
          }}
        >
          {range ? `${range.toString()}` : `Unlinked`}
        </Link>
      </FormHelperText>
    </FormControl>
  );
});
