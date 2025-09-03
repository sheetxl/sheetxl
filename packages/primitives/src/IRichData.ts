
/**
 * A complex object type. This allows for more complex data types to be stored in a cell.
 */
export interface IRichData {
  /**
   * Reference to either a known typename or a JSON Type Definition.
   * * {@link https://jsontypedef.com/}
   */
  // TODO - make this a getType()
  readonly type: string;
  // a compareTo for sorting?
  // comparable(other) // this is a java approach
  // isEqual?
  toJSON(): IRichData.JSON;
  fromJSON(): any;
};

export namespace IRichData {
  export interface JSON {
    type: string;
    data: any;
  }
}