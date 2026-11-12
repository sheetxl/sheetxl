import type React from 'react';
import { Fragment } from 'react';

import { Box } from '@mui/material';

import { type PivotChipMenuRenderProps } from '@sheetxl/react';

import { ExhibitDivider, ExhibitMenuItem, SelectedIcon } from '@sheetxl/utils-mui';

/**
 * A pivot table chip's menu as an Exhibit menu: the `renderMenu` the studio gives the PivotTable
 * Fields pane.
 */
export const PivotChipMenu = (props: PivotChipMenuRenderProps): React.ReactElement => {
  const { groups } = props;
  return (
    <Box role="menu" sx={{ paddingTop: '4px', paddingBottom: '4px' }}>
      {groups.map((group, i) => (
        <Fragment key={i}>
          {i > 0 ? <ExhibitDivider orientation="horizontal" /> : null}
          {group.map((entry) => (
            <ExhibitMenuItem
              key={entry.key}
              role={entry.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={entry.checked}
              disabled={entry.disabled}
              selected={entry.checked}
              icon={entry.checked ? <SelectedIcon /> : undefined}
              onClick={entry.run}
            >
              {entry.label}
            </ExhibitMenuItem>
          ))}
        </Fragment>
      ))}
    </Box>
  );
};

/** {@link PivotChipMenu} as a render slot. */
export const renderPivotChipMenu = (props: PivotChipMenuRenderProps): React.ReactNode => <PivotChipMenu {...props} />;
