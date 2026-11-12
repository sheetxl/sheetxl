import { type Scalar } from './Scalar';
import { type IRichMeta, type IRichType } from './IRichType';

/**
 * A complex object type. This allows for more complex data types to be stored in a cell.
 */
export interface IRichData {
  /**
   * The value's kind: the properties it has and how they show. Every value of a kind returns the
   * same instance.
   */
  getKind(): IRichType;
  /**
   * @param name The name of the property to retrieve.
   */
  getProperty(name: string): Scalar;
  /**
   * How the property `name` shows on this value: the value's own presentation where it differs
   * from its kind's (a price in another currency), else the kind's ({@link IRichType.Property.meta}).
   * `null`, or the method absent, for none.
   */
  getPropertyMeta?(name: string): IRichMeta | null;
  /**
   * The text shown for this value where nothing renders it: a client with no renderer for the
   * kind, a log, a placeholder. A rich text shows its text; an image a short description.
   *
   * @remarks
   * Display only. What the value reads as to calculation, sorting and the clipboard is
   * {@link toPrimitive}.
   */
  toString(): string;
  /**
   * The primitive this value reads as wherever one is consumed: `LEN`, `&`, `+`, comparison,
   * `ISTEXT`, `TYPE()`, sort, filter, find. A rich text reads as its text; an error that carries
   * more than its code reads as that error; an image reads as nothing (`null`, or the method
   * absent), and is `#VALUE!` wherever a primitive is needed.
   *
   * @remarks
   * The ordinary rules then apply to the primitive (text-to-number coercion, collation, error
   * propagation), so a value adds no coercions of its own.
   */
  toPrimitive?(): Exclude<Scalar, IRichData>;
  /**
   * The items this value unpacks to where a range or array is accepted (a list); `null`, or the
   * method absent, for a value that is one value.
   */
  toArray?(): Scalar[][] | null;
  /**
   * The value as JSON, which its kind makes it again from. A value that holds a resource (a
   * picture's bytes) names it by the id `toResourceId` answers, and the file saves the resource;
   * without `toResourceId` it names none.
   */
  toJSON?(toResourceId?: IRichData.ToResourceId): IRichData.JSON | Promise<IRichData.JSON>;
  /**
   * For runtime type checking.
   */
  get isIRichData(): true;
};

export namespace IRichData {
  /**
   * The id a file being saved gives a resource a value holds (an `IResource`); `null` when the
   * file does not save it.
   */
  export type ToResourceId = (resource: any) => number | null;

  export interface JSON {
    /** The name of the value's kind ({@link IRichType.getName}). */
    type: string;
    /** The value's own data, as its kind reads it. */
    data?: any;
    /**
     * Presentation for the properties where this value differs from its kind, by property name.
     */
    meta?: { readonly [property: string]: IRichMeta };
  }
}