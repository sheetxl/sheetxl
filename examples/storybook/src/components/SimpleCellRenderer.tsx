import { DefaultCellRenderer, CellRendererProps } from '@sheetxl/grid-react';

export const sharedCellRenderer = (props: CellRendererProps) => {
  const {
    key,
    // style: propStyle,
    ...rest
  } = props;
  return (
    <DefaultCellRenderer
      key={key}
      {...rest}
      value={`${props.range.rowStart}:${props.range.colStart}`}
    />
  );
};