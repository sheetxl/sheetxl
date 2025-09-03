/**
 * An object interface that defines a set of callback functions a user can use to get
 * notified of any set of {@link Observable}.
 *
 * @see {@link https://rxjs.dev/api/index/class/Observable | Observable}
 */
export class Observable<T=any> {
  protected _subscribeFn: (subscriber: Subscriber<T>) => () => void;
  constructor(subscribeFn: (subscriber: Subscriber<T>) => () => void) {
    this._subscribeFn = subscribeFn;
  }

  subscribe(next: any, error: (err: any) => void, complete: () => void) {
    // If the first argument is an object, assume it's an observer:
    const subscriber =
      typeof next === 'object'
        ? {
            next: next.next || (() => {}),
            error: next.error || (() => {}),
            complete: next.complete || (() => {}),
            unsubscribe: () => {}
          }
        : {
            next: next || (() => {}),
            error: error || (() => {}),
            complete: complete || (() => {}),
            unsubscribe: () => {}
          };

    // Call the user-defined subscribe function.
    // It should return a "teardown" function if needed.
    const teardown = this._subscribeFn(subscriber);

    // Assign unsubscribe so the consumer can stop the observable.
    subscriber.unsubscribe = () => {
      if (typeof teardown === 'function') {
        teardown();
      }
    };

    return subscriber;
  }
}


/**
 * An object interface that defines a set of callback functions a user can use to get
 * notified of any set of {@link Observable}.
 */
export interface Subscriber<T> {
  /**
   * A callback function that gets called by the producer during the subscription when
   * the producer "has" the `value`. It won't be called if `error` or `complete` callback
   * functions have been called, nor after the consumer has unsubscribed.
   */
  next: (value: T) => void;
  /**
   * A callback function that gets called by the producer if and when it encountered a
   * problem of any kind. The errored value will be provided through the `err` parameter.
   * This callback can't be called more than one time, it can't be called if the
   * `complete` callback function have been called previously, nor it can't be called if
   * the consumer has unsubscribed.
   */
  error: (err: any) => void;
  /**
   * A callback function that gets called by the producer if and when it has no more
   * values to provide (by calling `next` callback function). This means that no error
   * has happened. This callback can't be called more than one time, it can't be called
   * if the `error` callback function have been called previously, nor it can't be called
   * if the consumer has unsubscribed.
   */
  complete: () => void;

  unsubscribe: () => void;
}

/**
```
function evaluateCell(cellRef: string) {
  // 1. Get the cell's formula or logic
  const valueOrPromiseOrObservable = runCellFormula(cellRef);

  // 2. Decide how to handle the return type
  if (isObservable(valueOrPromiseOrObservable)) {
    // It's an observable -> subscribe to get multiple values over time
    const subscription = valueOrPromiseOrObservable.subscribe(
      newValue => {
        updateScalar(cellRef, newValue);
      },
      error => {
        setCellError(cellRef, error);
      },
      () => {
        markCellDone(cellRef); // The stream ended
      }
    );

    // Optionally store `subscription` if you need to unsubscribe later
    // or if your engine re-calculates and should tear down old streams:
    // cellSubscriptions.set(cellRef, subscription);

  } else if (valueOrPromiseOrObservable instanceof Promise) {
    // It's a promise -> just wait for one result
    valueOrPromiseOrObservable
      .then(newValue => {
        updateScalar(cellRef, newValue);
      })
      .catch(error => {
        setCellError(cellRef, error);
      });

  } else {
    // It's a synchronous value
    updateScalar(cellRef, valueOrPromiseOrObservable);
  }
}

```
*/