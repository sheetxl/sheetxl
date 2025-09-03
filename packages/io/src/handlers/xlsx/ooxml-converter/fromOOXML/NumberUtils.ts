import { CommonUtils } from '@sheetxl/utils';

export const EMU_PER_POINT: number = 12700; // EMU_PER_PIXEL * 1.3
export const EMU_PER_PIXEL: number = 9525;

export const toPoints = (emu: string): number => {
  if (!emu)
    return null;

  return CommonUtils.roundAccurately(parseFloat(emu) / EMU_PER_POINT, 4);
}

export const toPixels = (emu: string): number => {
  if (!emu)
    return null;

  return CommonUtils.roundAccurately(parseFloat(emu) / EMU_PER_PIXEL, 1);
}


/**
 * Converts a value of type FixedPoint to a movable point
 *
 * @param fixedPoint Value in fixed point notation
 * @returns movable point (double)
 *
 * @see <a href="http://msdn.microsoft.com/en-us/library/dd910765(v=office.12).aspx">[MS-OSHARED] - 2.2.1.6 FixedPoint</a>
 */
export const fixedPointToDouble = (fixedPoint: number): number => {
  const i = (fixedPoint >> 16);
  const f = fixedPoint & 0xFFFF;
  return (i + f/65536);
}

export const parsePercentage = (percent: string): number => {
  return parseFloat(percent) / 1000;
}

export const parseAngle = (angle: string): number => {
  return parseFloat(angle) / 60000;
}

export const parseAsBoolean = (value: string): boolean => {
  return value === 'true' || value === '1';
}
