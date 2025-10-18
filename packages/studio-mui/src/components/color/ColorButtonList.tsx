import React, { memo, useMemo, useCallback } from 'react';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { IColor } from '@sheetxl/sdk';

import { ReactUtils } from '@sheetxl/utils-react';

import { type SwatchProps } from './Swatch';
import { ColorButton } from './ColorButton';

export interface ColorButtonListProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;

  colorDefs: IColor.DefinitionWithLabel[] | IColor.DefinitionWithLabel[][];
  schemeColorLookup: IColor.SchemeLookup;

  selectedColor?: IColor;
  previewColor?: IColor;
  onSelectColorDef?: (colorDef: IColor.DefinitionWithLabel) => void;
  onPreviewColorDef?: (colorDef: IColor.DefinitionWithLabel) => void;

  propsSwatch?: Partial<SwatchProps>;
  compareRGB?: boolean;
  darkMode?: boolean;
}

export const ColorButtonList: React.FC<ColorButtonListProps> = memo((props: ColorButtonListProps) => {
  const {
    title,
    schemeColorLookup,
    colorDefs,
    selectedColor,
    previewColor,
    onSelectColorDef,
    onPreviewColorDef,

    style:propStyle = ReactUtils.EmptyCssProperties,
    compareRGB = false,
    darkMode,
    propsSwatch,
    ...rest
  } = props;

  let colorDefCols:IColor.DefinitionWithLabel[][];
  // if it's a single array then it's a single row
  // but if it's an array of array then it's a set of columns
  if (Array.isArray(colorDefs[0])) {
    colorDefCols = colorDefs as IColor.DefinitionWithLabel[][];
  } else {
    colorDefCols = [];
    for (let i=0; i<colorDefs.length; i++)
    colorDefCols.push([(colorDefs  as IColor.DefinitionWithLabel[])[i]]);
  }

  const handleSelectColorDef = useCallback((colorDef: IColor.DefinitionWithLabel) => {
    onSelectColorDef?.(colorDef);
  }, [onSelectColorDef]);

  const handlePreviewColorDef = useCallback((colorDef: IColor.DefinitionWithLabel) => {
    onPreviewColorDef?.(colorDef);
  }, [onPreviewColorDef]);

  const buttonCols = useMemo(() => {
    let retValue = [];
    for (let i=0; i<colorDefCols.length; i++) {
        let buttonRows = [];
        let colorCol = colorDefCols[i];
        for (let j=0; j<colorCol.length; j++) {
          let c = colorCol[j];
          buttonRows.push((
            <ColorButton
              schemeColorLookup={schemeColorLookup}
              colorDef={c}
              key={ i + ' ' + j }
              selectedColor={selectedColor}
              previewColor={previewColor}
              onSelectColorDef={handleSelectColorDef}
              onPreviewColorDef={handlePreviewColorDef}
              propsSwatch={propsSwatch}
              compareRGB={compareRGB}
              darkMode={darkMode}
            />
          ));
        }
        let buttonCol = (
          <Box
            className="button-col"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              //border: `solid ${theme.palette.divider} 1px`,
              boxShadow: (theme: Theme) => theme.shadows[2],
              borderRadius: `${2}px`,
              overflow: 'hidden'
             }}
            key={'' + i}
          >
            {buttonRows}
          </Box>
        );
        retValue.push(buttonCol);
    }
    return retValue;
  }, [colorDefCols, selectedColor, previewColor, handleSelectColorDef, handlePreviewColorDef]);

  const titleElement = useMemo(() => {
    if (!title)
      return null;
    return (
      <Typography
        noWrap={true}
        component="div"
        sx={{
          display: "flex",
          flexShrink: '0',
          paddingLeft: '6px',
          paddingBottom: '4px',
          paddingTop: '0px',
          userSelect: 'none',
          color: (theme: Theme) => theme.palette.text.secondary,
        }}
      >
        {title}
      </Typography>
    )
  }, [title]);

  return (
    <Box
      style={{
        ...propStyle
      }}
    >
      {titleElement}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          marginBottom: '14px',
          flexWrap: 'wrap',
          justifyContent: 'flex-start', // space-between
        }}
        {...rest}
        >
          {buttonCols}
      </Box>
    </Box>
  )
});