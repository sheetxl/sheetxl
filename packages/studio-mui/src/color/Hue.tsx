// @ts-nocheck
import type React from 'react';
import { Component, PureComponent } from 'react';

/**
 * Vendored from react-color to drop CJS-only `reactcss` dependency.
 */
export interface HueProps {
  hsl: any;
  direction?: 'horizontal' | 'vertical';
  radius?: any;
  shadow?: any;
  pointer?: any;
  style?: any;
  onChange?: (data: any, e: any) => void;
}

const calculateChange = (e, direction, hsl, container) => {
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const x = typeof e.pageX === 'number' ? e.pageX : e.touches[0].pageX;
  const y = typeof e.pageY === 'number' ? e.pageY : e.touches[0].pageY;
  const left = x - (container.getBoundingClientRect().left + window.pageXOffset);
  const top = y - (container.getBoundingClientRect().top + window.pageYOffset);

  if (direction === 'vertical') {
    let h;
    if (top < 0) {
      h = 359;
    } else if (top > containerHeight) {
      h = 0;
    } else {
      const percent = -(top * 100 / containerHeight) + 100;
      h = 360 * percent / 100;
    }
    if (hsl.h !== h) {
      return { h, s: hsl.s, l: hsl.l, a: hsl.a, source: 'hsl' };
    }
  } else {
    let h;
    if (left < 0) {
      h = 0;
    } else if (left > containerWidth) {
      h = 359;
    } else {
      const percent = left * 100 / containerWidth;
      h = 360 * percent / 100;
    }
    if (hsl.h !== h) {
      return { h, s: hsl.s, l: hsl.l, a: hsl.a, source: 'hsl' };
    }
  }
  return null;
};

export class Hue extends (PureComponent<HueProps> || Component<HueProps>) {
  handleChange = (e) => {
    const change = calculateChange(e, this.props.direction, this.props.hsl, this.container);
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

  componentWillUnmount() {
    this.unbindEventListeners();
  }

  unbindEventListeners() {
    window.removeEventListener('mousemove', this.handleChange);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  render() {
    const direction = this.props.direction ?? 'horizontal';
    const isVertical = direction === 'vertical';
    const absolute = { position: 'absolute', top: '0px', right: '0px', bottom: '0px', left: '0px' };
    const styles = {
      hue: {
        ...absolute,
        borderRadius: this.props.radius,
        boxShadow: this.props.shadow
      },
      container: {
        padding: '0 2px',
        position: 'relative',
        height: '100%',
        borderRadius: this.props.radius
      },
      pointer: {
        position: 'absolute',
        left: isVertical ? '0px' : `${this.props.hsl.h * 100 / 360}%`,
        ...(isVertical ? { top: `${-(this.props.hsl.h * 100 / 360) + 100}%` } : {})
      },
      slider: {
        marginTop: '1px',
        width: '4px',
        borderRadius: '1px',
        height: '8px',
        boxShadow: '0 0 2px rgba(0, 0, 0, .6)',
        background: '#fff',
        transform: 'translateX(-2px)'
      }
    };

    return (
      <div style={styles.hue}>
        <div
          className={`hue-${direction}`}
          style={styles.container}
          ref={(container) => { this.container = container; }}
          onMouseDown={this.handleMouseDown}
          onTouchMove={this.handleChange}
          onTouchStart={this.handleChange}
        >
          <style>{`
            .hue-horizontal {
              background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }
            .hue-vertical {
              background: linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
              background: -webkit-linear-gradient(to top, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            }
          `}</style>
          <div style={styles.pointer}>
            {this.props.pointer ? <this.props.pointer {...this.props} /> : <div style={styles.slider} />}
          </div>
        </div>
      </div>
    );
  }
}

export default Hue;
