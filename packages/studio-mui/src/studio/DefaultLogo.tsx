import React from 'react';

import { Box } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';
import { LogoNoPaddingIcon } from '@sheetxl/react';
import { ExhibitTooltip } from '@sheetxl/utils-mui';

/**
 * Wrapped in a component (rather than a bare element) so the tooltip's `t()` string is evaluated at
 * RENDER, not once at module load — a module-level element would freeze whatever language was active
 * when this file first imported. The brand name itself is deliberately NOT translated.
 */
const DefaultLogoTooltip = (): React.ReactElement => {
  const t = useTranslator();
  return (
  <ExhibitTooltip
    label={"SheetXL"}
    description={t('logo.description')}
  >
    <Box
      component="a"
      href="https://www.sheetxl.com"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'inline-flex',
        width:'24px',
        height: '24px',
        marginBottom: '4px',
        marginLeft: '6px',
        cursor: 'pointer'
      }}
    >
      {/* A real anchor (not window.open) so embedding hosts that block window.open — e.g. a VS Code
          webview — still open it, and for standard link affordances (middle-click, accessibility). */}
      <LogoNoPaddingIcon
        style={{
          width:'24px',
          height: '24px'
        }}
      />
    </Box>
  </ExhibitTooltip>
  );
};

export const DefaultLogo = <DefaultLogoTooltip/>;
