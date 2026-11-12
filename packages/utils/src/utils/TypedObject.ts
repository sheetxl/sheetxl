/**
 * TypedObject is a metadata entry that enabled traversing.
 *
 * @remarks
 * * If a type has properties defined and is an Object then it will be traversed.
 * * If a type has arrayType defined and is an Array then it will be traversed.
 */
export interface TypedObject<P, T, C> {
  /**
   * Normalizes an incoming update into this type's property shape.
   *
   * @returns The normalized properties, `null` to resolve to nothing, or `undefined` to decline -
   * `undefined` leaves the update exactly as it arrived, which is how a type opts out for the
   * inputs it has no opinion about. The three are distinct; see
   * {@link TypedObject.resolveTypedUpdates}.
   */
  shorthand?: (shorthand: string | Partial<P>, context: C) => Partial<P> | null | undefined;

  /**
   * Returns a new T that is the result of merging the update into the original.
   * If this is not defined then the default merging logic will be applied
   * This is used for specialized updates of properties.
   */
  merge?: (update: Partial<P> | ((original: P) => T), original: T | undefined, context: C) => Partial<P> | null;

  /**
   * Define the properties that are available.
   *
   * @remarks
   * This map is **exhaustive** - `Required` makes every key of `P` mandatory here, so the compiler
   * refuses a type that forgets one. That completeness is what lets
   * {@link TypedObject.resolveTypedUpdates} treat an undeclared key in an update as junk and drop
   * it rather than shallow-copying it into the resolved (and then persisted) properties.
   *
   * Use {@link TypedObject.PassThrough} for a key that needs no shorthand, merge or traversal - it
   * declares the key as known and takes its value verbatim.
   */
  properties?: TypedObject.Properties<Required<NonNullable<P>>, C>;

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
   * @param original The value being updated, when there is one. A partial update need not carry
   * enough information to identify its own subtype (e.g. `{ foreground: null }` says nothing about
   * whether the fill is a pattern); implementations should fall back to the original's subtype so
   * the partial merges into it rather than replacing it.
   * @returns Another TypedObject
   */
  getSubType?: (value: Partial<P>, original?: P) => TypedObject<P, any, C>;
}

/**
 * Undeclared keys are dropped silently as far as the resolved value is concerned, but they are
 * almost always a caller mistake, so the first occurrence of each name is reported. Keyed by name
 * only (a TypedObject has no identity) and warned once - a bad key in a style update can otherwise
 * arrive once per cell.
 */
const _warnedUnknownProperties = new Set<string>();

const _warnUnknownProperty = (key: string): void => {
  if (_warnedUnknownProperties.has(key)) return;
  _warnedUnknownProperties.add(key);
  console.warn(`Unknown property '${key}' in update; ignoring.`);
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
   * Declares a property as known without giving it any behavior - its value is taken verbatim.
   *
   * @remarks
   * Since {@link TypedObject.properties} is exhaustive, every key needs an entry even when it needs
   * no shorthand, merge or traversal. This is that entry. Prefer it over a fresh `{}` so the intent
   * ('known, nothing to do') is explicit and the object is shared.
   */
  export const PassThrough: TypedObject<any, any, any> = Object.freeze({});

  /**
   * Merged updates into updatesFrom. It used the template for values and the typedObject for navigating.
   *
   * @typeParam P The resolved (stored) shape.
   * @typeParam U The accepted *input* shape, which need not be `P` widened - a type may accept
   * convenience keys that its `shorthand` folds onto canonical ones and that never appear in `P`
   * (see `IFontStyle.Update`). Defaults to {@link TypedObject.ResolvableProperties} of `P`, and
   * is otherwise inferred from `update`; callers are expected to have already type-checked the
   * update against their own public modifier type.
   *
   * @param keepNulls If `true`, an explicit `null` in the update is recorded in the result (a
   * 'tombstone') instead of being dropped. Without this, 'explicitly cleared' and 'never mentioned'
   * are indistinguishable in the resolved object. Used when resolving an update against nothing to
   * build a reusable update template; the tombstones are honored (and dropped) by a later resolve
   * against a real `updateFrom`.
   *
   * @remarks
   * * Values not defined in the typed object will be shallow copied.
   * * This should only be used on simple objects that can be merged. (For example merging classes will strip away the class information)
   * * Note. We don't try to merge arrays.
   */
  export const resolveTypedUpdates = <P=any, C=any, U=TypedObject.ResolvableProperties<P>>(update: Readonly<U>, type: TypedObject<P, any, C>, context: C, updateFrom?: P, keepNulls: boolean=false): P => {
    if (update === null) return update as P;
    if (update === undefined) return updateFrom as P;

    let parsed:Partial<P> | null = (update as unknown as Partial<P>);
    // const isString = update && typeof update === 'string';
    if (type?.shorthand) {
      const shorthandUpdate:Partial<P> | null | undefined = type?.shorthand(update as unknown as (string | Partial<P>), context);
      // `undefined` declines - the update stands as it arrived. Distinct from `null`, which resolves
      // the whole value away.
      if (shorthandUpdate !== undefined)
        parsed = shorthandUpdate;
    }

    if (parsed !== null && type?.getSubType) {
      const subType = type.getSubType(parsed, updateFrom);
      if (subType)
        type = subType;
    }

    const properties = type?.properties;
    const isArray = type?.arrayType ?? false;

    let resolved:Partial<P> | null = parsed;

    if (type && type.merge && resolved && updateFrom) {
      resolved = type.merge(resolved, updateFrom, context);
    } else if (isArray) {
      // TODO - arrays not support at the moment, revisit for gradient stops
      // resolved = [] as P;
    } else if (properties) {
      const allKeys = Object.keys({
        ...parsed,
        ...updateFrom
      });
      resolved = null;
      const allKeysLength = allKeys.length;
      for (let k=0; k<allKeysLength; k++) {
        const key = allKeys[k] as keyof P;
        // `parsed` can be null here (a shorthand may resolve to null); optional chaining keeps
        // the merge falling back to `updateFrom` instead of throwing.
        let newValue = parsed?.[key];
        let resolvedProp = undefined;
        if (newValue !== undefined) {
          const propType = (properties as Record<keyof P, TypedObject<any, any, C>>)[key];
          if (propType) {
            resolvedProp = resolveTypedUpdates(newValue as any, propType, context, updateFrom?.[key], keepNulls);
          } else {
            // Undeclared key. `properties` is exhaustive over P, so this came from the caller and is
            // not a property of this type - a typo, a stale name, or a convenience key the type's
            // `shorthand` was supposed to fold away. Dropping it is the point: copying it through
            // would persist junk into the resolved properties, where it survives into toJSON and
            // makes two otherwise-identical property bags compare unequal.
            _warnUnknownProperty(key as string);
            continue;
          }
        } else {
          // Only in the update. A key that exists solely on `updateFrom` is carried over untouched -
          // sanitizing applies to what is coming IN, never to state that is already stored.
          resolvedProp = updateFrom?.[key];
        }
        if (resolvedProp !== null && resolvedProp !== undefined) {
          resolved = resolved ?? {} as P;
          resolved[key] = resolvedProp;
        } else if (keepNulls && newValue === null) {
          // An explicit `null` (not merely a sub-resolution that collapsed to nothing, e.g. `{}`)
          // is a clear instruction - record it so a later resolve against a real updateFrom honors it.
          resolved = resolved ?? {} as P;
          resolved[key] = null as any; // tombstone deliberately violates P[key]
        }
      }
    }

    return resolved as P;
  }
}
