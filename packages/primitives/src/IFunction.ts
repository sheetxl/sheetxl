import { type Scalar } from './Scalar';
import { type ScalarType } from './ScalarType';
import { type ValueKind } from './ValueKind';

/**
 * A self-describing, type-safe, executable function.
 *
 * Built-in and user-defined functions share this interface. It pairs the
 * callable entry point (`execute`) with type metadata to guarantee type safety
 * and auto-coerce arguments, plus locale-specific copy for UI display and validation.
 *
 * Formula authors encounter `IFunction` when calling another function by name
 * at evaluation time via `FormulaContext.getFunction`, or when tooling
 * introspects the function registry.
 *
 * @see {@link https://www.sheetxl.com/docs/guides/how-tos/write-a-custom-function | UDF authoring guide} for
 * how to create and register functions.
 */
export interface IFunction {
  /**
   * Execute the function
   */
  execute<R=any>(...args: any[]): R;
  /**
   * The name of the function.
   */
  getName(): string;
  /**
   * Contains type information needed to safely execute the function.
   */
  getDeclaration(): IFunction.IDeclaration;
  /**
   * Returns user-facing information about the function.
   */
  getDescriptor(locale?: string): Promise<IFunction.IDescriptor>;
  /**
   * Indicates whether the function is a built-in function.
   */
  isBuiltIn(): boolean;
  /**
   * Indicates whether the function is a `LAMBDA` rather than a built-in or registered function.
   *
   * @remarks
   * Two kinds of function answer `true`:
   *
   * - **A defined name whose body is `LAMBDA(…)`.** It is reachable by name like any other
   *   function, so signature help and function lookups can describe it: its parameters are the
   *   lambda's, and its summary is the name's comment, or the name's formula when it has no
   *   comment. A formula calls it through the NAME, never through {@link execute}, which answers
   *   `#CALC!`.
   * - **A `LAMBDA` passed as a value** and received by
   *   {@link IFunctionArguments.getFunctionsAt}. It has no name ({@link getName} is `''`), its
   *   parameters are the lambda's, and {@link execute} applies it.
   */
  isLambda(): boolean;
  /**
   * Returns the execution environment this function belongs to.
   *
   * @remarks
   * SheetXL exposes functions from multiple environments — the formula calculation
   * engine and the macro/scripting runtime — through the same `IFunction` interface.
   * The context identifier distinguishes them and determines which argument types and
   * calling conventions apply. Returns `null` for standard formula functions.
   */
  getContext(): string | null;
  /**
   * Type guard property. Always `true` on any `IFunction` instance.
   *
   * @remarks
   * Use this to distinguish an `IFunction` from other objects at runtime without
   * relying on `instanceof`, which does not work across module boundaries.
   */
  get isIFunction(): true;
}

/**
 * {@inheritDoc IFunction}
 *
 * @see
 * ### **Interface**
 *
 * {@link IFunction}
 */
export namespace IFunction {
  /**
   * Describes the type characteristics of a value used as a function parameter or return value.
   *
   * @remarks
   * If `getScalarType` is `null` and `getRangeType` is `null`, the value is untyped. Not all
   * runtimes will allow this.
   */
  export interface IValueType {
    /**
     * Indicates that the value is a single, scalar cell-compatible value.
     *
     * @remarks
     * This corresponds to a `ScalarType` such as `Number`, `Boolean`, or `String`.
     * `'*'` is a scalar of undeclared type — still provably a scalar, unlike untyped.
     * `ScalarType.Null` is permitted only for event handler return types.
     */
    getScalarType(): ScalarType | '*' | null;
    /**
     * Indicates that the value is a range (multi-cell) structure.
     *
     * - `p`: A `RangeReference`, representing a pointer to sheet coordinates.
     * - `r`: A `Range`, representing the actual values in the range.
     * - `m`: A materialized array (`Scalar[]` or `Scalar[][]`) that has been extracted from the range.
     *
     * If specified, the function supports multi-cell or structured range inputs.
     */
    getRangeType(): 'p' | 'r' | 'm' | '*' | null;
    /**
     * Indicates that the value is a LAMBDA (a function value), and what it produces — which is
     * also what the marshalled callable coerces each result to.
     *
     * - `'*'`: any SCALAR — each result coerces to one scalar.
     * - a `ScalarType`: the lambda's declared return.
     * - `'raw'`: a declared `any` return — results pass uncoerced (`REDUCE`'s accumulator).
     * - `null`: not a lambda.
     *
     * @remarks
     * A lambda is neither a value nor a location, so this is the accessor to ask before concluding
     * anything from {@link getScalarType} — which reports `'l'` alongside a lambda for historical
     * reasons, a spelling outside its own declared `ScalarType | '*' | null`.
     *
     * Applies to both parameters (`BYROW`'s `fn`) and the one return that is a lambda (`LAMBDA`).
     */
    getLambda(): ScalarType | '*' | 'raw' | null;
    /**
     * Defines the number of array signatures after a parameter.
     * - `0`: No array signature. The value is scalar or a single cell.
     * - `1`: Will flatten.
     * - `2`: Nest.
     */
    getArrayDepth(): number;
  }

  /**
   * Describes the parameter to a function, including its name, type,
   * whether it's required, and if it's a rest parameter.
   */
  export interface IParameterType extends IValueType {
    /**
     * The name of the parameter.
     */
    getName(): string;
    /**
     * True when a BARE error at this parameter — an error instead of a value or a range, `NA()`,
     * `#NAME?`, a union where one rectangle is needed — is delivered to the body RAW rather than
     * propagated: the `AcceptError<T>` marker. A rule, not a type — the engine's auto-reject is
     * off at this slot, and the body narrows with `FormulaError.isError` if it cares.
     *
     * @remarks
     * The default, and the common case, is that the error propagates with its identity and the
     * body never runs. The marker never looks INSIDE a container: an error member of a range
     * reaches the body either way and is the body's to judge (`IRange.firstError`).
     *
     * @see {@link ParameterTypeJSON.acceptError}
     */
    isAcceptError(): boolean;
    /**
     * True when a multi-cell REFERENCE at this scalar parameter is `#VALUE!` rather than a
     * broadcast — the `NoLift<T>` marker.
     *
     * @see {@link ParameterTypeJSON.noLift}
     */
    isNoLift(): boolean;
    /**
     * True when the members reaching this repeating scalar parameter are coerced rather than
     * filtered — the `NoFilter<T>` marker.
     *
     * @see {@link ParameterTypeJSON.noFilter}
     */
    isNoFilter(): boolean;
    /**
     * True when the argument at this parameter may reach the body UNEVALUATED, as an `ILazy`
     * handle — the `Lazy<T>` marker.
     *
     * @see {@link ParameterTypeJSON.lazy}
     */
    isLazy(): boolean;
    /**
     * True when the parameter takes EITHER a value or a range, decided per argument by its kind —
     * an `IRange | Scalar` union.
     *
     * @see {@link ParameterTypeJSON.valueOrRange}
     */
    isValueOrRange(): boolean;
    /**
     * Indicates whether the parameter is required.
     */
    isOptional(): boolean;
    /**
     * The value the parameter's own initializer supplies when the argument is ABSENT, or
     * `undefined` where none can be read.
     *
     * @see {@link ParameterTypeJSON.defaultValue}
     */
    getDefaultValue(): Scalar | undefined;
    /**
     * The SLOTS of a repeating parameter group, or `null` when this parameter is not one.
     *
     * @remarks
     * A repeating group is one declared parameter whose arguments arrive as a fixed-size cycle
     * repeated N times — `SUMIFS(sum, r1, c1, r2, c2, …)` is a `[criteriaRange, criteria]` group.
     * The returned array IS the cycle, so `getRepeatingTypes()!.length` is the period and argument
     * `i` binds to slot `(i − prefixLength) % period`.
     *
     * This is a NESTED node rather than a flattened list on purpose: a flat list cannot be
     * re-segmented, and every consumer (the site predicate, the arity check, the function wizard)
     * needs the period to bind an argument position to a slot.
     *
     * A period-1 group carries a single slot with the same name as the parameter, which is what
     * makes it display identically to a rest parameter (`array1, array2, …`).
     *
     * Only the LAST slot may be optional, and it means one thing: it may be omitted when there is
     * exactly one repetition (`SORTBY(array, by1)` is legal; `SORTBY(array, by1, o1, by2)` is not).
     *
     * @see {@link Repeating}
     */
    getRepeatingTypes(): readonly IFunction.IParameterType[] | null;
    /**
     * Indicates whether the parameter is a rest parameter (accepts multiple arguments).
     *
     * @remarks
     * - A rest parameter can only be the last parameter in a function.
     * - If `rest` is `true`, the parameter is also considered optional.
     *
     * A rest parameter is the degenerate repeating group: period 1, no minimum. Prefer
     * {@link getRepeatingTypes} (`Repeating<T>`) when at least one argument is required.
     */
    isRest(): boolean;
    /**
     * The enum the parameter is limited to, or `null` when it takes any value of its type.
     *
     * @remarks
     * Declared by typing the parameter as a TypeScript `enum`, as an alias paired with a same-name
     * `as const` object, or as a union of number or string literals (`0 | 1`).
     *
     * @see {@link IEnum}
     */
    getEnum(): IFunction.IEnum | null;
  }

  /**
   * One member of an {@link IEnum}.
   */
  export interface IEnumMember {
    /**
     * The declared member name (`End`). For a union of bare literals, which names nothing, this is
     * the value as text.
     */
    getName(): string;
    /**
     * The value a formula passes. Typed, and never localized.
     */
    getValue(): number | string;
    /**
     * Whether the member is declared but not offered, from the member's `@deprecated` tag.
     *
     * @remarks
     * A deprecated member stays in the set, so a formula that passes it is not refused and the
     * function decides what it answers. It is left out of the argument dropdown and the values
     * a warning lists. A string is the tag's label (`Excel desktop only`).
     */
    isDeprecated(): boolean | string;
  }

  /**
   * A closed set of values a parameter accepts.
   *
   * @remarks
   * All members are numbers or all are strings; the two never mix. The set is free-form: it does
   * not have to be contiguous or start at zero (`-1 | 0 | 1`).
   */
  export interface IEnum {
    /**
     * The declared type name (`PaymentType`), unique within the module that declares it. For a
     * union of bare literals it is the values joined by `|`.
     */
    getId(): string;
    /**
     * Whether the members are numbers or strings.
     */
    getScalarType(): typeof ScalarType.Number | typeof ScalarType.String;
    /**
     * The members, in declaration order.
     */
    getMembers(): readonly IFunction.IEnumMember[];
  }

  /**
   * Describes the runtime return behavior of a function, including modifiers like volatility.
   *
   * @remarks
   * If none are specified, The value will be returned with no special behavior.
   */
  // TODO - I am not sure this is the correct approach. We are not even using this as we dynamically check
  export interface IReturnType extends IValueType {
    /**
     * The declared {@link ValueKind} of the result — the declared override where one exists, else
     * the kind the type spellings imply — or `null` when the result's kind follows the value
     * itself (`'*'`, an untyped return).
     *
     * @see {@link ReturnTypeJSON.kind}
     */
    getKind(): ValueKind | null;
    /**
     * True when the result can change with nothing dirty, so a cell naming this function
     * recalculates on every pass — the `Volatile<T>` marker.
     *
     * @remarks
     * STATIC, and read from the formula text at compile time: it is true of the call whether or
     * not the call runs, which is what a lazy argument requires.
     *
     * @see {@link ReturnTypeJSON.volatile}
     */
    isVolatile(): boolean;
  }

  /**
   * The type-system metadata the engine reads to coerce arguments, apply broadcasting,
   * and validate calls before execution. This is separate from {@link IDescriptor},
   * which carries locale-specific user-facing copy.
   */
  export interface IDeclaration {
    /**
     * Named of the actual function in code.
     *
     * @remarks
     * The unique identifier for the function. It has a number of rules:
     * * The only characters allowed are: (A-Z, 0-9, _m .)
     * * Character casing is ignored and will be converted to upper.
     * * At least 2 characters.
     * * Must start with a letter (A-Z).
     * * Must be globally unique.
     * * Must not be a reserved word.
     * * Must not be a built-in function.
     */
    getName(): string;
    /**
     * An array of `Parameter` objects describing the function's parameters.
     *
     * @remarks
     * If not specified, the function is assumed to be volatile (its output might change even if its inputs haven't).
     */
    getParameters(): readonly IParameterType[];
    /**
     * The largest number of arguments a call to this function may carry.
     *
     * @remarks
     * Only meaningful for a VARIADIC function; a fixed parameter list is already its own maximum.
     * The number is the whole CALL's argument count, prefix and optional suffix included, and it
     * is refused at entry, before evaluation.
     *
     * @see {@link Repeating}
     */
    getMaxArguments(): number;
    /**
     * Metadata describing the type and dimensionality of the return value.
     *
     * @defaultValue `{ type: 'void' }`
     */
    getReturnType(): IReturnType;
    /**
     * Whether the function is left out of function lists, from its `@hidden` or `@deprecated` tag.
     *
     * @remarks
     * A hidden function is still callable from a formula and still found by name. Listing calls
     * leave it out unless asked to include it. {@link IDescriptor.isDeprecated} carries the tag's
     * label, if it has one.
     */
    isHidden(): boolean;
  }

  /**
   * Locale-specific, user-facing metadata: display name, summary, category, and
   * parameter descriptions shown in the formula bar and autocomplete UI.
   * Separate from {@link IDeclaration}, which carries the type-system metadata
   * the engine uses for coercion and broadcasting.
   */
  export interface IDescriptor {
    /**
     * The canonical name of the function, matching {@link IDeclaration.getName}.
     *
     * @remarks
     * A descriptor may override the name; when it does not, this is the name of the function
     * in code. Use {@link getNameLocal} for display.
     */
    getName(): string;
    /**
     * The function's name in the user's language (the active spreadsheet-language pack), e.g. `SUMME`
     * for `SUM` in German — Excel's `getXxxLocal()` convention (`getFormulaLocal`/`getNumberFormatLocal`).
     * Falls back to the canonical {@link getName} when the active language does not translate it (English
     * is always accepted). {@link getName} stays the canonical identity; only display uses this.
     */
    getNameLocal(): string;
    /**
     * A description of the function's purpose and usage.
     */
    getSummary(): string;
    /**
     * A category or group to which the function belongs.
     */
    getCategory(): string;
    /**
     * The label of the function's `@hidden` or `@deprecated` tag (`Unimplemented`), `true` for a tag
     * with no label, or `false`.
     *
     * @remarks
     * Whether the function is listed is {@link IDeclaration.isHidden}; this is the text to show for it.
     */
    isDeprecated(): boolean | string;
    /**
     * An array of links associated with the value.
     */
    getLinks(): readonly [url: string, text?: string][];
    /**
     * Describe each parameter in the function.
     *
     * @remarks
     * Each field is optional — a parameter may declare only a description, only an example, or nothing.
     * The keys are the declaration parameter names (see {@link IParameterType.getName}).
     */
    getParameters(): Readonly<Record<string, { description?: string, example?: string, defaultValue?: Scalar }>>;
    /**
     * Describe each enum the function's parameters are limited to.
     *
     * @remarks
     * The keys are enum ids (see {@link IEnum.getId}), and within one the member names (see
     * {@link IEnumMember.getName}). Every enum a parameter declares has an entry and every member
     * has one within it, so a caller can read a label without checking: `nameLocal` falls back to
     * the declared name. Values are never localized — they are on the declaration.
     */
    getEnums(): Readonly<Record<string, IFunction.IEnumDescription>>;
  }

  /**
   * The copy for one enum: what it is, and what each member means.
   */
  export interface IEnumDescription {
    /** The enum's name in the user's language, or its declared name. */
    readonly nameLocal: string;
    /** What the enum controls. */
    readonly summary?: string;
    /** By member name. */
    readonly members: Readonly<Record<string, {
      /** The member's name in the user's language, or its declared name. */
      readonly nameLocal: string;
      readonly description?: string;
    }>>;
  }

  /**
   * Describes the type characteristics of a function parameter or return value.
   *
   * At least one of `scalar`, `range`, or `context` must be defined.
   */
  export interface ValueTypeJSON {
    /**
     * Indicates that the value is a single, scalar cell-compatible value.
     *
     * @remarks
     * This corresponds to a `ScalarType` such as `Number`, `Boolean`, or `String`.
     * `ScalarType.Null` is permitted only for event handler return types.
     */
    scalar?: ScalarType | string;
    /**
     * Indicates that the value is a range (multi-cell) structure.
     *
     * - `p`: A `RangeReference`, representing a pointer to sheet coordinates.
     * - `r`: A `Range`, representing the actual values in the range.
     * - `m`: A materialized array (`Scalar[]` or `Scalar[][]`) that has been extracted from the range.
     * - `*`: Any value — a scalar or a range. Declared `any`, and the same `*`-means-any spelling
     *   as {@link scalar} and {@link lambda}.
     *
     * If specified, the function supports multi-cell or structured range inputs.
     *
     * @remarks
     * A `*` parameter is handed the whole argument, whatever it is. It is a VALUE position rather
     * than a range one, which matters when another parameter causes the call to broadcast: a `*`
     * parameter follows that broadcast and receives one element per position, where an `r`/`p`
     * parameter would receive the whole range on every call. It never causes a broadcast itself.
     *
     * `IF(logical, valueIfTrue, valueIfFalse)` is the canonical shape — the branches are `*`, so
     * a single condition returns the chosen branch untouched while an array condition selects
     * element by element.
     */
    range?: 'p' | 'r' | 'm' | '*';
    /**
     * Indicates that the value is a lambda function, and what the lambda RETURNS — which is also
     * what the marshalled callable coerces each result to:
     *
     * - a `ScalarType`: that scalar.
     * - `*`: any SCALAR — each result still coerces to ONE scalar (a 1×1 range/reference unwraps,
     *   an error embeds as a value, a larger shape is `#CALC!` for the whole call).
     * - `raw`: a declared `any` return (`Lambda<Args, any>`) — results pass to the body
     *   uncoerced. `REDUCE` is the case: its accumulator threads raw, which is what makes an
     *   array/reference accumulator legal.
     *
     * If specified, the function supports lambda inputs.
     */
    lambda?: ScalarType | '*' | 'raw';
    /**
     * The lambda's declared parameter count, from the `Lambda<Args, R>` tuple.
     *
     * Enforced by the marshaller at the call — a callable that cannot take exactly this many
     * arguments is `#VALUE!` for the whole call, before any element runs (an eta-reduced function
     * name defers to its own dispatch). Absent when the declaration leaves arity open
     * (`Lambda<any[], R>`): a lambda slot in a repeating group then requires one parameter per
     * OTHER argument of the call; anywhere else the arity is unchecked.
     */
    lambdaArity?: number;
    /**
     * Defines the number of array signatures after a parameter.
     * - `0`: No array signature. The value is scalar or a single cell.
     * - `1`: Will flatten.
     * - `2`: Nest.
     * - `3`: Array of arrays of arrays (e.g. for 3D ranges or arrays of tables)
     *
     * @defaultValue `0` if no `range` is defined, otherwise `1`.
     */
    arrayDepth?: number;
    /**
     * A short description of the value's purpose or expected usage.
     */
    description?: string;
  }

  /**
   * Describes the parameter to a function, including its name, type,
   * whether it's required, and if it's a rest parameter.
   */
  export interface ParameterTypeJSON extends ValueTypeJSON {
    /**
     * The name of the parameter.
     */
    name: string;
    /**
     * Indicates whether the parameter is required.
     *
     * @defaultValue true
     */
    optional?: boolean;
    /**
     * The value the parameter's own initializer supplies when the argument is ABSENT.
     *
     * @remarks
     * Descriptive rather than applied: an absent argument is never pushed, so the initializer
     * supplies the value itself. It is recorded so help text, tooltips and completions can say
     * "defaults to 3" without reading the source. The exception is a {@link lazy} slot, which has
     * no initializer to run — `Lazy<T, V>` declares the default here and the engine applies it.
     *
     * Present for a literal initializer only. One computed from another argument
     * (`numberS2: number = numberS`) has no value to record and leaves this undefined.
     *
     * Concerns the ABSENT position specifically; {@link omittedValue} covers what an argument
     * supplied EMPTY means, which is frequently a different value.
     */
    defaultValue?: Scalar;
    /**
     * An argument supplied EMPTY (`FIXED(1.5,)`) does not coerce to the parameter's type.
     * Generated from the `Omittable<T>` marker.
     *
     * @remarks
     * Undeclared, an omitted argument reaches the body as `0` / `false` / `""` — the right default
     * for most functions, and what `VLOOKUP(x,r,2,)` means by an exact match. Declared, the
     * argument arrives as {@link omittedValue} where one is given, and otherwise as `undefined`,
     * letting the parameter's own initializer supply it so that an omitted argument means what an
     * absent one means.
     *
     * A blank CELL in the same position is unaffected and continues to coerce: it is a value the
     * caller supplied, where an omitted argument is the caller supplying none.
     *
     * @see {@link Omittable}
     */
    omittable?: boolean;
    /**
     * What an argument supplied EMPTY means, where that differs from the absent default. Generated
     * from the second type argument of `Omittable<T, V>`.
     *
     * @remarks
     * Left undeclared where the two coincide, which is the common case — the parameter's own
     * initializer then serves both positions. It is declared where a function distinguishes them:
     * `MATCH(3,{2})` is `1` while `MATCH(3,{2},)` is `#N/A`, giving `matchType` the declaration
     * `Omittable<number, 0> = 1`.
     *
     * Implies {@link omittable}. Unlike {@link defaultValue}, which only records what the
     * initializer would supply, this value is applied by the engine.
     */
    omittedValue?: Scalar;
    /**
     * Indicates whether the parameter is a rest parameter (accepts multiple arguments).
     *
     * @remarks
     * - A rest parameter can only be the last parameter in a function.
     * - If `rest` is `true`, the parameter is also considered optional.
     */
    rest?: boolean;
    /**
     * The SLOTS of a repeating parameter group, generated from the `Repeating<T>` marker.
     *
     * @remarks
     * Present iff this parameter IS a group; its own `scalar`/`range`/`arrayDepth` are then unset
     * and the slots carry the types. The array length is the group's PERIOD. Cannot be combined
     * with {@link rest}.
     *
     * @see {@link IParameterType.getRepeatingTypes}
     */
    repeating?: ParameterTypeJSON[];
    /**
     * A BARE error at this parameter — an error instead of a value or a range — is delivered to
     * the body RAW rather than propagated: the engine's auto-reject is off at this slot, and the
     * body narrows if it cares. Generated from the `AcceptError<T>` marker. A failed COERCION to
     * the declared type is delivered the same way, as the `#VALUE!` it would have raised, so a
     * body that rethrows what it receives answers exactly as the engine would have — and one that
     * reads its arguments in its own order can (`IFS(TRUE,1,"x",2)` is 1: the pair is never
     * reached).
     *
     * @remarks
     * OMITTED is the default (ErrorPolicy.ts): the error propagates with its identity (a scalar
     * argument), becomes an error member of the output (a lifted member), or short-circuits on the
     * first error in argument order (a flattened list) — the body never runs. A
     * `FormulaError.Known`-typed parameter receives without the marker, because the type declares
     * it. On a TYPED range (`IRange<number>`) the marker also lets error members ride through the
     * typed read raw — COUNT's profile. Errors INSIDE a range are otherwise never the marker's
     * business: a valid range is handed over whole.
     */
    acceptError?: boolean;
    /**
     * The argument's subtree may be handed over UNEVALUATED, as an `ILazy` handle the body either
     * returns unread or forces with `getValue()`. Generated from the `Lazy<T>` marker.
     *
     * @remarks
     * A declaration, not a request: the engine defers where it can and DECLINES where it cannot
     * (an absent argument, an async subtree, a lift that needs every arm), handing over a handle
     * that is already full. Either way the body sees a handle and nothing else, which is why the
     * marker is a contract rather than something inferred from what the body happens to read.
     *
     * Only a RESULT position carries it — `IF`'s branches, `CHOOSE`'s arms, `IFERROR`'s fallback.
     * A condition, an index or a case value is eager, so `AND(FALSE,A1)` still reads `A1` and is
     * still a circular reference.
     *
     * {@link defaultValue} is APPLIED at a lazy slot rather than merely recorded: the parameter
     * cannot carry an initializer of its own (`= false` does not typecheck against a handle), so
     * `Lazy<T, V>` declares it and the engine supplies it for an absent argument.
     *
     * @see {@link Lazy}
     */
    lazy?: boolean;
    /**
     * A multi-cell REFERENCE at this scalar parameter is `#VALUE!` rather than a broadcast.
     * Generated from the `NoLift<T>` marker.
     *
     * @remarks
     * Per parameter, because Excel's built-ins differ by slot: `NETWORKDAYS.INTL` refuses a
     * reference at its date slots and lifts one at `weekend`. An ARRAY at the slot still lifts, a one-cell reference is an
     * ordinary argument, and a repeating slot absorbs a container as members, so the marker only
     * ever applies to a non-repeating scalar parameter.
     */
    noLift?: boolean;
    /**
     * The members reaching this repeating scalar parameter are COERCED rather than filtered, and
     * one that cannot be coerced is `#VALUE!` for the whole call. Generated from the `NoFilter<T>`
     * marker.
     *
     * @remarks
     * Numeric text parses, a blank inside a multi-cell range reads 0, and a boolean or
     * non-numeric text member refuses — Excel's Analysis-ToolPak reading of a repeating slot,
     * where the native family skips all three (`GCD({6,"8",12})` is 2 where `SUM` would answer
     * over 6 and 12 alone). Only a repeating slot has members, so the marker applies nowhere
     * else; a non-repeating scalar's counterpart is {@link noLift}.
     */
    noFilter?: boolean;
    /**
     * The declared type is ADVISORY: the engine delivers it when it can and hands the body the
     * raw argument when it cannot, instead of answering `#VALUE!` at the slot. Generated from the
     * `ReportType<T>` marker.
     *
     * @remarks
     * The type still reaches the function help, the wizard and the linter — it is what the slot
     * means to a caller. It stops being a gate, so the BODY owns every answer the engine would
     * otherwise have given: a union reaches it as `IRange[]`, a value or an error reaches it as
     * itself. See {@link IFunctionArguments.getKindAt} and
     * {@link IFunctionArguments.getAreaCountAt} for the discriminators.
     */
    reportType?: boolean;
    /**
     * The parameter takes EITHER a value or a range — declared as a two-member union of a bare
     * range type and a scalar type (`IRange | Scalar`, `IReferenceRange | number`) — and the
     * marshaller picks the arm by the ARGUMENT's kind: a value, a bare error or a one-cell
     * reference is the scalar arm (dereferenced, coerced to {@link scalar}, its fault raised in
     * argument order like any scalar slot's); a multi-cell reference, an array or a reference
     * union is the range arm, handed over whole. The slot never lifts.
     *
     * @remarks
     * Some array slots read a one-cell argument as THE ARGUMENT rather than as a
     * one-cell container: `SORT(<#N/A cell>,1,1,<#DIV/0! cell>)` is `#N/A` where
     * `TAKE(<#N/A cell>,<#DIV/0! cell>)` is `#DIV/0!`. The engine's default
     * for a range slot is TAKE's; this flag is SORT's. {@link scalar} and {@link range} each carry
     * their arm, a pair that without this flag reads as a TYPED range (`IRange<number>`).
     */
    valueOrRange?: boolean;
    /**
     * The closed set of values the parameter accepts. Generated from a parameter typed as a
     * TypeScript `enum`, as an alias paired with a same-name `as const` object, or as a union of
     * number or string literals. {@link scalar} carries the members' type.
     *
     * @remarks
     * Parameters that share a declared enum share one `EnumJSON`, by {@link EnumJSON.id}.
     */
    enum?: EnumJSON;
  }

  /**
   * The JSON form of an {@link IEnum}.
   */
  export interface EnumJSON {
    /**
     * The declared type name, unique within the declaring module. A union of bare literals has no
     * name, so its id is the values joined by `|`.
     */
    id: string;
    /**
     * Whether the members are numbers or strings. The two never mix.
     */
    type: typeof ScalarType.Number | typeof ScalarType.String;
    /**
     * The members, in declaration order. A union of bare literals names nothing, so each name is
     * the value as text.
     */
    members: [name: string, value: number | string, deprecated?: string | true][];
  }

  /**
   * Describes the runtime return behavior of a function, including modifiers like volatility.
   *
   * @remarks
   * If none are specified, The value will be returned with no special behavior.
   */
  // TODO - I am not sure this is the correct approach. We are not even using this as we dynamically check
  export interface ReturnTypeJSON extends ValueTypeJSON {
    /**
     * The declared {@link ValueKind} of the result, where the inherited type spellings cannot say
     * it. Generated from the `@returnKind` marker.
     *
     * @remarks
     * A return type is a pair — is the call a REFERENCE, and what is its value kind. Both halves
     * usually derive from the type spellings: {@link ValueTypeJSON.range} `'p'` (an
     * `IReferenceRange` return, which a function whose value paths are casts may also use —
     * `XLOOKUP`, `TAKE`) is `Reference`; `'r'`/`'m'` is `Array`; a concrete
     * {@link ValueTypeJSON.scalar} is that scalar kind; `'*'` or an untyped return follows the
     * value itself. This field overrides the derivation for the one spelling that loses it — a
     * union like `number[] | number[][]` (`ROW`) collapses to `'*'`, yet the function's one-cell
     * answer is a SCALAR (`TYPE(ROW(A1))` is 1 where `TYPE(TRANSPOSE({5}))` is 64).
     *
     * The engine applies the kind at the call exit: a one-cell range result whose declared kind
     * is a scalar is its member value downstream.
     */
    kind?: ValueKind;
    /**
     * The result can change with nothing dirty — a cell naming this function recalculates on
     * every pass. Generated from the `Volatile<T>` marker.
     *
     * @remarks
     * Collected at COMPILE time from the formula text (`CompiledFormula.hasVolatile`), because
     * that is where volatility is decided: `=IF(TRUE,1,RAND())` recalculates on every idle pass though
     * no branch selects the arm, and with lazy arguments the call never happens for the engine to
     * observe.
     *
     * @see {@link Volatile}
     */
    volatile?: boolean;
  }

  /**
   * Contains metadata about a function declaration, including its name, return type, parameters, and additional documentation.
   */
  export interface DeclarationJSON {
    /** @inheritdoc IFunction.IDeclaration.getName */
    name: string;
    /** @inheritdoc IFunction.IDeclaration.getReturnType */
    returnType?: ReturnTypeJSON;
    /** @inheritdoc IFunction.IDeclaration.getParameters */
    parameters?: ParameterTypeJSON[];
    /**
     * The largest number of arguments a call may carry, from `Repeating<T, Max>` on the variadic
     * parameter. Omitted at the default of 255.
     *
     * @remarks
     * The cap is one number per NAME, compared against the whole call's argument count, so a call
     * past it is refused AT ENTRY rather than answered — which is why the cap lives on the
     * declaration and not in a body. It is not derivable from the shape: in Excel `STDEV` takes 255
     * arguments and `STDEV.S`, the same function under its dotted name, takes 254.
     *
     * @defaultValue 255
     */
    maxArguments?: number;
    /**
     * Describes the execution context required by the function.
     *
     * Contexts fall into two categories:
     *
     * - **Macro contexts**: Used by macro-style functions to access parts of the document or selection:
     *   - `'Workbook'`: The entire workbook
     *   - `'Sheet'`: A single sheet
     *   - `'Range'`: A selected sheet range
     *   - `'Ranges'`: Multiple selected ranges
     *
     * - **Calculation context**: Used by formula functions like `OFFSET` or `INDIRECT`
     *   that need access to evaluation position or sheet metadata during calculation.
     *   This context is available in headless or worker environments.
     *
     * @remarks
     * * If omitted, the function is consider a FormulaFunction.
     * * If a function has a context it will be passed as the first argument to `execute`.
     * * If the context is `IFunction.Calculation` then the function must return a value.
     * * If the context is not `IFunction.Calculation` then the function must return `void` or a cleanup function.
     */
    // TODO - remove this an just use the parameter list.
    // rename to host?
    context?: string;//ITypedFunction.Context;
    /**
     * Leave the function out of function lists.
     *
     * @defaultValue `false`
     *
     * @see {@link IDeclaration.isHidden}
     */
    hidden?: boolean;
     /**
     * Additional metadata about the function's behavior or requirements.
     */
    // required for started.
    // TODO - rename to modifiers?
    behavior?: BehaviorJSON;
  }

  /**
   * Contains user information about the function.
   *
   * @remarks
   * This is locale specific.
   */
  export interface DescriptorJSON {
    /**
     * A overwritten name for the function.
     *
     * @defaultValue The name of the function in code.
     */
    name?: string;
    /**
     * The function name in the user's language (spreadsheet-language pack), e.g. `SUMME`. Snapshot
     * for the language the descriptor was resolved for; absent ⇒ falls back to {@link name}.
     */
    nameLocal?: string;
    /**
     * A more detailed explanation of the function's purpose and usage.
     */
    summary?: string;
    /**
     * A category or group to which the function belongs.
     *
     * @defaultValue 'custom'
     */
    category?: string;
    /**
     * The label of a `@hidden` or `@deprecated` tag, or `true` for a tag with no label.
     *
     * @defaultValue `false`
     *
     * @remarks
     * Display text only. Whether the function is listed is {@link DeclarationJSON.hidden}.
     */
    deprecated?: string | boolean;
    /**
     * An array of links associated with the value.
     */
    links?: [url: string, text?: string][];
    /**
     * Describe each parameter in the function.
     */
    parameters?: Record<string, { description: string, example?: string, defaultValue?: Scalar }>;
    /**
     * Describe each enum the function's parameters are limited to, by enum id.
     */
    enums?: Record<string, EnumDescriptorJSON>;
  }

  /**
   * The JSON form of an {@link IEnumDescription}. Every field is optional: an enum with no doc
   * comments has nothing to say, and a language pack may translate any part of one.
   */
  export interface EnumDescriptorJSON {
    nameLocal?: string;
    summary?: string;
    members?: Record<string, { nameLocal?: string, description?: string }>;
  }

  /**
   * Contains extended metadata about a function that is not be directly inferable from the code itself.
   */
  export interface BehaviorJSON {
    /**
     * If `true` this function will be called on load unless scripts are disabled.
     *
     * @defaultValue `false`.
     */
    // TODO - rename autoRun? (or something else)
    default?: boolean;
    /**
     * Indicates whether the function's execution can be canceled by the user.
     *
     * @defaultValue false
     */
    cancelable?: boolean;

    // volatile - static
    // formatted
  }


}
