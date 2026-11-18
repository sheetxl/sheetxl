import { memo, useEffect, useReducer } from 'react';

import { type IShape } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type MovablePaneProps } from '@sheetxl/react';

import { FormatEditor, type FormatTarget } from '../format';

/**
 * The body of the format pane for a shape: the format editor on the shape's fill and line, applying
 * live to the shape.
 */
export const ShapeFormatPanel = memo((props: MovablePaneProps) => {
  const { movable, sheet } = props;
  const t = useTranslator();
  const shape = movable.getContent<IShape>();

  // Live apply: what the pane shows follows what it just wrote, and any other write to the shape.
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => shape.addListeners({ onAnyChange: refresh }), [shape]);

  const style = shape.getStyle();
  const target: FormatTarget = {
    id: shape.getId(),
    title: shape.getTypeDescription(),
    disabled: shape.isReadOnly(),
    // Effects and Size & Properties join as tabs; one tab alone shows no strip.
    tabs: [{
      key: 'fillLine',
      label: t('format.tab.fillLine'),
      fields: () => [
        { type: 'fill', key: 'fill', label: t('shape.pane.fill'), style },
        { type: 'line', key: 'line', label: t('shape.pane.line'), style }
      ]
    }]
  };

  return <FormatEditor target={target} sheet={sheet}/>;
});

ShapeFormatPanel.displayName = 'ShapeFormatPanel';
