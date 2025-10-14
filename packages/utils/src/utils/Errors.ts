export class ChainedError extends Error {
  private _cause: Error;
  constructor(message: string, cause: Error=null) {
    // new feature. Update ts.lib
    //@ts-ignore
    super(message, cause);
    this.name = 'ChainedError'
    this._cause = cause;
  }

  get cause(): Error {
    return this._cause;
  }
}

/**
 * Special classification that that indicated the error is caused by user input.
 */
export class ExpectedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * Special classification for error that are out of bounds.
 */
export class OutOfBoundsError extends ExpectedError {
  constructor(message: string='Out of bounds', cause: Error=null) {
    super(message, cause);
    this.name = "OutOfBoundsError";
  }
}

/**
 * Special classification that suggests there was a partial error.
 */
export class PartialError extends ChainedError {
  constructor(message: string='Partial Error', cause: Error=null) {
    super(message, cause);
  }
}

export class NullNotAllowedError extends ChainedError {
  constructor(message: string='Null not supported', cause: Error=null) {
    super(message, cause);
  }
}

/**
 * This error provides a predefined error code.
 */
export class TypedError extends Error {
  private _type: string;
  constructor(message: string='Null not supported', type: string) {
    super(message);
    this._type = type;
  }

  get type() {
    return this._type;
  }
}

export class NotImplementedError extends ChainedError {
  constructor(message: string='Not implemented', cause: Error=null) {
    super(message, cause);
  }
}

/**
 * Recursively collects all errors in the cause chain, deepest first
 */
const collectErrorChain = (error: Error, expected: boolean=false): Array<{ error: Error; depth: number }> => {
  const errors: Array<{ error: Error; depth: number }> = [];

  const traverse = (currentError: Error, depth: number = 0) => {
    if (!currentError) return;

    // Add current error
    errors.push({ error: currentError, depth });

    if (expected && (currentError instanceof ExpectedError)) return;
    const cause = currentError.cause;
    // Recursively traverse cause chain
    if (!cause || !(cause instanceof Error)) return;
    traverse(cause, depth + 1);
  };

  traverse(error);

  // Return deepest first (reverse the array)
  return errors.reverse();
};


export const ErrorUtils = {
  collectErrorChain
}