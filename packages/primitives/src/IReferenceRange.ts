import type { Scalar } from './Scalar';
import type { IRange } from './IRange';

/**
 * A range that belongs to a container; usually a sheet.
 */
export interface IReferenceRange<T extends Scalar=Scalar> extends IRange<T> {
  /**
   * Adds coordinates to a range reference.
   */
  getCoords(): IRange.Coords;

  /**
   * For runtime type checking.
   */
  get isIReferenceRange(): true;
}