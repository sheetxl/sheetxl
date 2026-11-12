import { IRange, ScalarType } from '@sheetxl/primitives';

export const IncludeEmpty = Object.freeze({
  includeEmpty: true
});

export const ColumnOriented = Object.freeze({
  axis: IRange.Axis.Column
});

export const RowOriented = Object.freeze({
  axis: IRange.Axis.Row
});

export const ColumnOrientedNumbers = Object.freeze({
  type: ScalarType.Number,
  axis: IRange.Axis.Column
});
