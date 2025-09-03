import type { Scalar } from './Scalar';
import type { ScalarType } from './ScalarType';

/**
 * Provides interfaces for defining and working with functions at runtime, including metadata for
 * function declarations and execution scripts.
 */
export interface IFunction {
  /**
   * Execute the function
   */
  execute<T=any>(...args: any[]): T;
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
   * Returns the context in which the function is executed.
   *
   * @remarks
   * Not all functions have a context.
   */
  getContext(): string | null;
  /**
   * For runtime reflection.
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
   * Describes the type characteristics of a function parameter or return value.
   *
   * At least one of `Scalar`, `IRange`, or `Context` must be defined.
   */
  export interface IValueType {
    /**
     * Indicates that the value is a single, scalar cell-compatible value.
     *
     * @remarks
     * This corresponds to a `ScalarType` such as `Number`, `Boolean`, or `String`.
     * `ScalarType.Null` is permitted only for event handler return types.
     */
    getScalarType(): ScalarType;
    /**
     * Indicates that the value is a range (multi-cell) structure.
     *
     * - `r`: A `RangeReference`, representing a pointer to sheet coordinates.
     * - `l`: A `RangeLiteral`, representing the actual values in the range.
     * - `a`: A materialized array (`Scalar[]` or `Scalar[][]`) that has been extracted from the range.
     *
     * If specified, the function supports multi-cell or structured range inputs.
     */
    getRangeType(): 'r' | 'l' | 'a';
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
     * Indicates whether the parameter is required.
     */
    isOptional(): boolean;
    /**
     * Indicates whether the parameter is a rest parameter (accepts multiple arguments).
     *
     * @remarks
     * - A rest parameter can only be the last parameter in a function.
     * - If `rest` is `true`, the parameter is also considered optional.
     */
    isRest(): boolean;
    /**
     * Indicates whether the function requires the address of the calling cell as an input.
     * Cannot be combined with `stream`.
     */
    getEnums(): readonly string[];
  }

  /**
   * Describes the runtime return behavior of a function, including modifiers like
   * async resolution, streaming data, or volatility.
   *
   * @remarks
   * All return type modifiers are mutually exclusive.
   * If none are specified, The value will be returned with no special behavior.
   */
  // TODO - I am not sure this is the correct approach. We are not even using this as we dynamically check
  export interface IReturnType extends IValueType {
    /**
     * Indicates the return value is a Promise or Promise-like (i.e., async).
     * The system will mark the result as pending and re-trigger evaluation once resolved.
     *
     * Can be combined with any scalar, array, or range return type.
     */
    isAsync(): boolean;
    /**
     * Indicates whether the function produces a continuous stream of output (e.g., real-time data).
     *
     * @defaultValue `false`
     */
    isStreaming(): boolean;
  }

  /**
   * Contains metadata about a function declaration, including its name, return type, parameters, and additional documentation.
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
     * Metadata describing the type and dimensionality of the return value.
     *
     * @defaultValue `{ type: 'void' }`
     */
    getReturnType(): IReturnType;
  }

  /**
   * Contains user information about the function.
   *
   * @remarks
   * This is locale specific.
   */
  export interface IDescriptor {
    /**
     * A overwritten name for the function.
     */
    getName(): string;
    /**
     * A description of the function's purpose and usage.
     */
    getSummary(): string;
    /**
     * A category or group to which the function belongs.
     */
    getCategory(): string;
    /**
     * If `true` the function is available but will not be returned in search
     * results unless hidden is specifically requested.
     * If this is a string it can be used to provide a hidden label.
     *
     * @defaultValue 'null'
     *
     * @remarks
     * This is useful for functions that are unimplemented or deprecated.
     */
    isHidden(): boolean | string;
    /**
     * An array of links associated with the value.
     */
    getLinks(): readonly [url: string, text?: string][];
    /**
     * Describe each parameter in the function.
     */
    getParameters(): Readonly<Record<string, { description: string, example: string, defaultValue?: string }>>;
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
     * - `r`: A `RangeReference`, representing a pointer to sheet coordinates.
     * - `l`: A `RangeLiteral`, representing the actual values in the range.
     * - `a`: A materialized array (`Scalar[]` or `Scalar[][]`) that has been extracted from the range.
     *
     * If specified, the function supports multi-cell or structured range inputs.
     */
    range?: 'r' | 'l' | 'a';
    /**
     * Defines the number of array signatures after a parameter.
     * - `0`: No array signature. The value is scalar or a single cell.
     * - `1`: Will flatten.
     * - `2`: Nest.
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
     * Indicates whether the parameter is a rest parameter (accepts multiple arguments).
     *
     * @remarks
     * - A rest parameter can only be the last parameter in a function.
     * - If `rest` is `true`, the parameter is also considered optional.
     */
    rest?: boolean;
    /**
     * Indicates whether the function requires the address of the calling cell as an input.
     * Cannot be combined with `stream`.
     *
     * @defaultValue `false`
     */
    enums?: string[];

    // some excel functions allow for repeating pairs (i.e. SUMIFS)
    // repeating?: ParameterType[]
  }

  /**
   * Describes the runtime return behavior of a function, including modifiers like
   * async resolution, streaming data, or volatility.
   *
   * @remarks
   * If none are specified, The value will be returned with no special behavior.
   */
  // TODO - I am not sure this is the correct approach. We are not even using this as we dynamically check
  export interface ReturnTypeJSON extends ValueTypeJSON {
    /**
     * Indicates the return value is a Promise or Promise-like (i.e., async).
     * The system will mark the result as pending and re-trigger evaluation once resolved.
     *
     * Can be combined with any scalar, array, or range return type.
     */
    async?: boolean;
    /**
     * Indicates whether the function produces a continuous stream of output (e.g., real-time data).
     *
     * @defaultValue `false`
     */
    // TODO - replace with Observable<T>
    stream?: boolean;
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
    // rename to scope?
    context?: string;//ITypedFunction.Context;
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
     * If `true` is usable in calculation but not provided in the ui.
     * If this is a string it can be used to provide a hidden label.
     *
     * @defaultValue 'null'
     *
     * @remarks
     * This is useful for functions that are unimplemented or deprecated.
     */
    hidden?: string | boolean;
    /**
     * An array of links associated with the value.
     */
    links?: [url: string, text?: string][];
    /**
     * Describe each parameter in the function.
     */
    parameters?: Record<string, { description: string, example?: string, defaultValue?: Scalar }>;
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
    // TODO - rename to something else? autoRun?
    default?: boolean;
    // /**
    //  * Indicates whether the function's execution can be canceled by the user.
    //  *
    //  * @defaultValue false
    //  */
    cancelable?: boolean;

    // volatile - static
    // formatted
  }

}
