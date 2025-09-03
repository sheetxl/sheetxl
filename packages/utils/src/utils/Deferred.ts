/**
 * Deferred is a utility class to create a promise that can be resolved or rejected without
 * having to pass an executor function.
 */
export default class Deferred<T = any> {
  private _resolve:any = null;
  private _result:any = undefined;
  private _handled:string = null;

  private _reject:any = null;
  private _error:any = undefined;

  private _promise: Promise<T> = null;

  constructor() {
      this._promise = new Promise<T>((resolve:any, reject:any): void => {
      this._resolve = resolve;
      this._reject = reject;
      if (this._handled === "resolve") {
        resolve(this._result);
      } else if (this._handled === "reject") {
        reject(this._error);
      }
      // timeout to reject?
    });
  }

  resolve(result?: T | Promise<T>): void {
    if (this._resolve) {
      this._resolve(result);
    } else if (!this._handled) {
      this._result = result;
    }
    this._handled = "resolve";
  }

  reject(error?: any): void {
    if (this._reject) {
      this._reject(error);
    } else if (!this._handled) {
      this._error = error;
    }
    this._handled = "reject";
  }

  async wait() {
    await this._promise;
  }
}

export { Deferred };