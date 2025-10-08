/*
 * Scroller
 * http://github.com/zynga/scroller
 *
 * Copyright 2011, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/scroller/master/MIT-LICENSE.txt
 *
 * Based on the work of: Unify Project (unify-project.org)
 * http://unify-project.org
 * Copyright 2011, Deutsche Telekom AG
 * License: MIT + Apache (V2)
 */

/**
 * Generic animation class with support for dropped frames both optional easing and duration.
 *
 * Optional duration is useful when the lifetime is defined by another condition than time
 * e.g. speed of an animating object, etc.
 *
 * Dropped frame logic allows to keep using the same updater logic independent from the actual
 * rendering. This eases a lot of cases where it might be pretty complex to break down a state
 * based on the pure time difference.
 */
let time = Date.now;

let desiredFrames = 60;
let millisecondsPerSecond = 1000;
let running: Record<number, boolean|null> = {};
let counter = 1;

/**
 * Stops the given animation.
 *
 * @param id Unique animation ID
 * @returns Whether the animation was stopped (aka, was running before)
 */
export const stop = (id: number): boolean => {
  let cleared = (running[id] !== null);
  if (cleared) {
    running[id] = null;
  }
  return cleared;
};


/**
 * Whether the given animation is still running.
 *
 * @param id Unique animation ID
 * @returns Whether the animation is still running
 */
export const isRunning = (id: number): boolean => {
  return running[id] !== null;
};

/**
 * Start the animation.
 *
 * @param stepCallback {Function} Pointer to function which is executed on every step.
 *   Signature of the method should be `function(percent, now, virtual) { return continueWithAnimation; }`
 * @param verifyCallback {Function} Executed before every animation step.
 *   Signature of the method should be `function() { return continueWithAnimation; }`
 * @param completedCallback {Function}
 *   Signature of the method should be `function(droppedFrames, finishedAnimation, optional wasFinished) {}`
 * @param duration {Integer} Milliseconds to run the animation
 * @param easingMethod {Function} Pointer to easing function
 *   Signature of the method should be `function(percent) { return modifiedValue; }`
 * @returns Identifier of animation. Can be used to stop it any time.
 */
export const  start = (
  stepCallback: (percent: number, now: number, virtual?: boolean) => boolean,
  verifyCallback: (id: number) => boolean,
  completedCallback: (droppedFrames: number, finishedAnimation: number, wasFinished?: boolean) => void,
  duration: number=0,
  easingMethod?: (percent: number) => number
): number => {
  let start: number = time();
  let lastFrame = start;
  let percent = 0;
  let dropCounter = 0;
  let droppedFrames = 0;
  let id = counter++;

  // Compacting running db automatically every few new animations
  if (id % 20 === 0) {
    const newRunning = {};
    for (let usedId in running) {
      newRunning[usedId] = true;
    }
    running = newRunning;
  }

  // This is the internal step method which is called every few milliseconds
  const step = function (virtual) {
    // Normalize virtual value
    let render = virtual !== true;

    // Get current time
    let now = time();

    // Verification is executed before next animation step
    let shouldContinue = true;
    try {
      shouldContinue = (!verifyCallback || verifyCallback(id)) ?? true;
    } catch (error: any) {
      // Handle verify function errors gracefully
      shouldContinue = false;
    }

    if (!running[id] || !shouldContinue) {
      running[id] = null;
      completedCallback?.(desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond), id, false);
      return;
    }

    // For the current rendering to apply let's update omitted steps in memory.
    // This is important to bring internal state variables up-to-date with progress.
    if (render) {
      droppedFrames = Math.round((now - lastFrame) / (millisecondsPerSecond / desiredFrames)) - 1;
      for (let j = 0; j < Math.min(droppedFrames, 4); j++) {
        step(true);
        dropCounter++;
      }
    }

    // Compute percent value
    if (duration) {
      percent = (now - start) / duration;
      if (percent > 1) {
        percent = 1;
      }
    }

    // Execute step callback, then...
    let value = easingMethod ? easingMethod(percent) : percent;
    let stepResult = false;
    try {
      stepResult = stepCallback(value, now, render);
    } catch (error: any) {
      // Handle step function errors gracefully
      stepResult = false;
    }

    if ((stepResult === false || percent === 1) && render) {
      running[id] = null;
      completedCallback?.(
        desiredFrames - dropCounter / ((now - start) / millisecondsPerSecond),
        id,
        percent === 1 || duration == null
      );
    } else if (render) {
      lastFrame = now;
      requestAnimationFrame(step);
    }
  };

  // Mark as running
  running[id] = true;

  // Init first step
  requestAnimationFrame(step);

  // Return unique animation ID
  return id;
};
