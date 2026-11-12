import { type Scalar } from './Scalar';
import { type IRange } from './IRange';

/**
 * A reference range is a range that also has coordinates.
 *
 * @remarks
 * IReferenceRange can be used in functions that need ranges with coordinates.
 * Work example (e.g. INDEX, OFFSET, etc).
 * * Returning an IReferenceRange will create a dynamic dependency that will
 *   call the function if the data at those bounds are updated. This should be used sparingly.
 */
export interface IReferenceRange<T extends Scalar=Scalar> extends IRange<T> {
  /**
   * Adds coordinates to a range reference.
   */
  getCoords(): Readonly<IRange.Coords>;

  /**
   * For runtime type checking.
   */
  get isIReferenceRange(): true;
}