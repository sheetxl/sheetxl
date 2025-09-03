// @ts-nocheck
import React, { Component, PureComponent } from 'react';

/**
 * A set of ColorSpace from tinycolor
 */
interface ColorSpace {
  hsl: any;
  hex: any;
  rgb: any;
  hsv: any;
  source: any;
}

export interface SaturationProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  white?: any;
  black?: any;
  pointer?: any;
  circle?: any;

  hsl: any;
  hsv: any;

  onChange: (newState: ColorSpace | string) => void;
}

// Copied from lodash. CommonUtil does not have a cancel like this one.

// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time. Normally, the throttled function will run
// as much as it can, without ever going more than once per `wait` duration;
// but if you'd like to disable the execution on the leading edge, pass
// `{leading: false}`. To disable execution on the trailing edge, ditto.
const throttle = function(func, wait, options) {
  let timeout;
  let context;
  let args;
  let result;
  var previous = 0;
  if (!options) options = {};

  let later = function() {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  let throttled = function() {
    var now = Date.now();
    if (!previous && options.leading === false) previous = now;
    var remaining = wait - (now - previous);
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };

  throttled.cancel = function() {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
};

// const delay = function(func, wait, args) {
//   return setTimeout(function() {
//     return func.apply(null, args);
//   }, wait);
// };

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.

// const debounce = function(func, wait, immediate) {
//   var timeout, result;

//   var later = function(context, args) {
//     timeout = null;
//     if (args) result = func.apply(context, args);
//   };

//   var debounced = function(args) {
//     if (timeout) clearTimeout(timeout);
//     if (immediate) {
//       var callNow = !timeout;
//       timeout = setTimeout(later, wait);
//       if (callNow) result = func.apply(this, args);
//     } else {
//       timeout = delay(later, wait, this, args);
//     }

//     return result;
//   };

//   debounced.cancel = function() {
//     clearTimeout(timeout);
//     timeout = null;
//   };

//   return debounced;
// };

const calculateChange = (e: any, hsl: any, container: any) => {
  var _container$getBounding = container.getBoundingClientRect(),
      containerWidth = _container$getBounding.width,
      containerHeight = _container$getBounding.height;

  var x = typeof e.pageX === 'number' ? e.pageX : e.touches[0].pageX;
  var y = typeof e.pageY === 'number' ? e.pageY : e.touches[0].pageY;
  var left = x - (container.getBoundingClientRect().left + window.pageXOffset);
  var top = y - (container.getBoundingClientRect().top + window.pageYOffset);

  if (left < 0) {
    left = 0;
  } else if (left > containerWidth) {
    left = containerWidth;
  }

  if (top < 0) {
    top = 0;
  } else if (top > containerHeight) {
    top = containerHeight;
  }

  var saturation = left / containerWidth;
  var bright = 1 - top / containerHeight;

  return {
    h: hsl.h,
    s: saturation,
    v: bright,
    a: hsl.a,
    source: 'hsv'
  };
};

/**
 * copied from react-color to add a preventDefault to the mouse event on drag to create cleaner drag experience.
 * TODO - properly type types
 * TODO - on drag change cursor to drag cursor
 * TODO - make hook
 * TODO - replace common throttle/debounce with this one (as it has a cancel)
 */
export class Saturation extends (PureComponent<SaturationProps> || Component<SaturationProps>) {

  constructor(props: SaturationProps) {
    super(props)

    this.throttle = throttle((fn, data, e) => {
      fn(data, e)
    }, 50)
  }

  componentWillUnmount() {
    this.throttle.cancel()
    this.unbindEventListeners()
  }

  getContainerRenderWindow() {
    const { container } = this;
    let renderWindow:Window | typeof globalThis = window;
    while (!renderWindow.document.contains(container) && renderWindow.parent !== renderWindow) {
      renderWindow = renderWindow.parent
    }
    return renderWindow
  }

  handleChange = (e) => {
    typeof this.props.onChange === 'function' && this.throttle(
      this.props.onChange,
      calculateChange(e, this.props.hsl, this.container),
      e,
    );
    e.preventDefault();
  }

  handleMouseDown = (e) => {
    this.handleChange(e)
    const renderWindow = this.getContainerRenderWindow()
    renderWindow.addEventListener('mousemove', this.handleChange)
    renderWindow.addEventListener('mouseup', this.handleMouseUp)
  }

  handleMouseUp = (e) => {
    e.preventDefault();
    this.unbindEventListeners()
  }

  unbindEventListeners() {
    const renderWindow = this.getContainerRenderWindow()
    renderWindow.removeEventListener('mousemove', this.handleChange)
    renderWindow.removeEventListener('mouseup', this.handleMouseUp)
  }

  render() {
    const { color, white, black, pointer, circle } = this.props || {}
    const absolute:React.CSSProperties = {
      position: 'absolute',
      top: '0px',
      left: '0px',
      right: '0px',
      bottom: '0px'
    }
    const styles = {
      color: {
        ...absolute,
        backgroundColor: `hsl(${ this.props.hsl?.h },100%, 50%)`,
        borderRadius: this.props.style?.borderRadius,
      },
      white: {
        ...absolute,
        borderRadius: this.props.style?.borderRadius,
      },
      black: {
        ...absolute,
        boxShadow: this.props.style?.boxShadow,
        borderRadius: this.props.style?.borderRadius,
      },
      pointer: {
        ...absolute,
        top: `${ -(this.props.hsv?.v * 100) + 100 }%`,
        left: `${ this.props.hsv?.s * 100 }%`,
        cursor: 'default',
      },
      circle: {
        width: '4px',
        height: '4px',
        boxShadow: `0 0 0 1.5px #fff, inset 0 0 1px 1px rgba(0,0,0,.3),
          0 0 1px 2px rgba(0,0,0,.4)`,
        borderRadius: '50%',
        cursor: 'hand',
        transform: 'translate(-2px, -2px)',
      },
    };

    return (
      <div
        style={ styles.color }
        ref={ container => this.container = container }
        onMouseDown={ this.handleMouseDown }
        onTouchMove={ this.handleChange }
        onTouchStart={ this.handleChange }
      >
        <style>{`
          .saturation-white {
            background: -webkit-linear-gradient(to right, #fff, rgba(255,255,255,0));
            background: linear-gradient(to right, #fff, rgba(255,255,255,0));
          }
          .saturation-black {
            background: -webkit-linear-gradient(to top, #000, rgba(0,0,0,0));
            background: linear-gradient(to top, #000, rgba(0,0,0,0));
          }
        `}</style>
        <div style={ styles.white } className="saturation-white">
          <div style={ styles.black } className="saturation-black" />
          <div style={ styles.pointer }>
            { this.props.pointer ? (
              <this.props.pointer { ...this.props } />
            ) : (
              <div style={ styles.circle } />
            ) }
          </div>
        </div>
      </div>
    );
  }
}

export default Saturation