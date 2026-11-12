// @ts-nocheck
import type React from 'react';
import { Component, PureComponent } from 'react';

import { Checkboard } from './Checkboard';

/**
 * Vendored from react-color to drop CJS-only `reactcss` dependency.
 *
 * The checkerboard is rendered via the local
 * `Checkboard`, passing `grey="rgba(0,0,0,.08)"` to match react-color's default.
 * Behavior is otherwise unchanged.
 */
export interface AlphaProps {
  rgb: any;
  hsl: any;
  a?: any;
  direction?: 'horizontal' | 'vertical';
  radius?: any;
  shadow?: any;
  pointer?: any;
  renderers?: any;
  style?: any;
  onChange?: (data: any, e: any) => void;
}

const calculateChange = (e, hsl, direction, initialA, container) => {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const x = typeof e.pageX === 'number' ? e.pageX : e.touches[0].pageX;
  const y = typeof e.pageY === 'number' ? e.pageY : e.touches[0].pageY;
  const left = x - (container.getBoundingClientRect().left + window.pageXOffset);
  const top = y - (container.getBoundingClientRect().top + window.pageYOffset);

  if (direction === 'vertical') {
    let a;
    if (top < 0) {
      a = 0;
    } else if (top > containerHeight) {
      a = 1;
    } else {
      a = Math.round(top * 100 / containerHeight) / 100;
    }
    if (hsl.a !== a) {
      return { h: hsl.h, s: hsl.s, l: hsl.l, a, source: 'rgb' };
    }
  } else {
    let a;
    if (left < 0) {
      a = 0;
    } else if (left > containerWidth) {
      a = 1;
    } else {
      a = Math.round(left * 100 / containerWidth) / 100;
    }
    if (initialA !== a) {
      return { h: hsl.h, s: hsl.s, l: hsl.l, a, source: 'rgb' };
    }
  }
  return null;
};

export class Alpha extends (PureComponent<AlphaProps> || Component<AlphaProps>) {
  handleChange = (e) => {
    const change = calculateChange(e, this.props.hsl, this.props.direction, this.props.a, this.container);
    change && typeof this.props.onChange === 'function' && this.props.onChange(change, e);
  }

  handleMouseDown = (e) => {
    this.handleChange(e);
    window.addEventListener('mousemove', this.handleChange);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  handleMouseUp = () => {
    this.unbindEventListeners();
  }

  unbindEventListeners = () => {
    window.removeEventListener('mousemove', this.handleChange);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  componentWillUnmount() {
    this.unbindEventListeners();
  }

  render() {
    const { rgb } = this.props;
    const isVertical = this.props.direction === 'vertical';
    const absolute = { position: 'absolute', top: '0px', right: '0px', bottom: '0px', left: '0px' };
    const horizontalGradient = `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b}, 0) 0%,
           rgba(${rgb.r},${rgb.g},${rgb.b}, 1) 100%)`;
    const verticalGradient = `linear-gradient(to bottom, rgba(${rgb.r},${rgb.g},${rgb.b}, 0) 0%,
           rgba(${rgb.r},${rgb.g},${rgb.b}, 1) 100%)`;
    const styles = {
      alpha: { ...absolute, borderRadius: this.props.radius },
      checkboard: { ...absolute, overflow: 'hidden', borderRadius: this.props.radius },
      gradient: {
        ...absolute,
        background: isVertical ? verticalGradient : horizontalGradient,
        boxShadow: this.props.shadow,
        borderRadius: this.props.radius
      },
      container: {
        position: 'relative',
        height: '100%',
        margin: '0 3px'
      },
      pointer: {
        position: 'absolute',
        left: isVertical ? 0 : `${rgb.a * 100}%`,
        ...(isVertical ? { top: `${rgb.a * 100}%` } : {})
      },
      slider: {
        width: '4px',
        borderRadius: '1px',
        height: '8px',
        boxShadow: '0 0 2px rgba(0, 0, 0, .6)',
        background: '#fff',
        marginTop: '1px',
        transform: 'translateX(-2px)'
      }
    };

    return (
      <div style={styles.alpha}>
        <div style={styles.checkboard}>
          <Checkboard grey="rgba(0,0,0,.08)" renderers={this.props.renderers} />
        </div>
        <div style={styles.gradient} />
        <div
          style={styles.container}
          ref={(container) => { this.container = container; }}
          onMouseDown={this.handleMouseDown}
          onTouchMove={this.handleChange}
          onTouchStart={this.handleChange}
        >
          <div style={styles.pointer}>
            {this.props.pointer ? <this.props.pointer {...this.props} /> : <div style={styles.slider} />}
          </div>
        </div>
      </div>
    );
  }
}

export default Alpha;
