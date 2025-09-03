/**
 * TypedObject is a metadata entry that enabled traversing.
 *
 * @remarks
 * * If a type has properties defined and is an Object then it will be traversed.
 * * If a type has arrayType defined and is an Array then it will be traversed.
 */
export interface TypedObject<P, T, C> {
  /**
   * Returns null if shorthand is not understood.
   */

  shorthand?: (shorthand: string | Partial<P>, context: C) => Partial<P> | null;

  /**
   * Returns a new T that is the result of merging the update into the original.
   * If this is not defined then the default merging logic will be applied
   * This is used for specialized updates of properties.
   */
  merge?: (update: Partial<P> | ((original: P) => T), original: T | undefined, context: C) => Partial<P> | null;

  /**
   * Define the properties that are available.
   */
  properties?: TypedObject.Properties<Partial<P>, C>;//<Required<P>, C>;

  /**
   * If the type is an array it can have an arrayType.
   * This should only be defined if the current TypeObject is an array.
   * This would be the un-arrayed type
   */
  // TODO - correctly type
  // https://stackoverflow.com/questions/41253310/typescript-retrieve-element-type-information-from-array-type
  // https://learntypescript.dev/09/l2-conditional-infer
  arrayType?: TypedObject<T extends (infer E)[] ? E : any, P, C>;

  /**
   * Used for a determining a sub type based on the value.
   *
   * @param value The value to determine the subtype for.
   * @returns Another TypedObject
   */
  getSubType?: (value: Partial<P>) => TypedObject<P, any, C>;
}

export namespace TypedObject {
  /**
   * A wrapper around a property that enabled metadata typing.
   */
  export type Properties<P, C> = {
    /**
     * Is either a typed version of the property or a function that takes the current value and returns a typed version
     */
    [Property in keyof P]: TypedObject<P[Property], any, C>;
  }

  export type ResolvableProperties<T> = Partial<{
    [Property in keyof T]: T[Property] | string | null | ResolvableProperties<T[Property]>;
  }>

  /**
   * Merged updates into updatesFrom. It used the template for values and the typedObject for navigating.
   *
   * @remarks
   * * Values not defined in the typed object will be shallow copied.
   * * This should only be used on simple objects that can be merged. (For example merging classes will strip away the class information)
   * * Note. We don't try to merge arrays.
   */
  export const resolveTypedUpdates = <P=any, C=any>(update: Readonly<TypedObject.ResolvableProperties<P>>, type: TypedObject<P, any, C>, context: C, updateFrom?: P): P => {
    if (update === null) return update as P;
    if (update === undefined) return updateFrom;

    let parsed:Partial<P> = (update as Partial<P>);
    // const isString = update && typeof update === 'string';
    if (type?.shorthand) {
      const shorthandUpdate:Partial<P> = type?.shorthand(update as (string | Partial<P>), context);
      if (shorthandUpdate !== undefined)
        parsed = shorthandUpdate;
    }

    if (parsed !== null && type?.getSubType) {
      const subType = type.getSubType(parsed);
      if (subType)
        type = subType;
    }

    const properties = type?.properties;
    const isArray = type?.arrayType ?? false;

    let resolved:Partial<P> = parsed;

    if (type && type.merge && resolved && updateFrom) {
      resolved = type.merge(resolved, updateFrom, context);
    } else if (isArray) {
      // TODO - arrays not support at the moment, revisit for gradient stops
      // resolved = [] as P;
    } else if (properties) {
      // Note - we are using the keys from the parsed object. We do this so that they don't have to be defined
      // in the type but perhaps we should go that route because then we can sanitized the keys (and values). Requires changed Type.properties to be Required<P
      const allKeys = Object.keys({
        ...parsed,
        ...updateFrom
      });
      resolved = null;
      const allKeysLength = allKeys.length;
      for (let k=0; k<allKeysLength; k++) {
        const key = allKeys[k];
        let newValue = parsed[key];
        let resolvedProp = undefined;
        if (newValue !== undefined) {
          const propType = properties[key];
          if (propType) {
            resolvedProp = resolveTypedUpdates(newValue,propType, context, updateFrom?.[key]);
          } else {
            resolvedProp = newValue;
          }
        } else {
          resolvedProp = updateFrom?.[key];
        }
        if (resolvedProp !== null && resolvedProp !== undefined) {
          resolved = resolved ?? {} as P;
          resolved[key] = resolvedProp;
        }
      }
    }

    return resolved as P;
  }
}
