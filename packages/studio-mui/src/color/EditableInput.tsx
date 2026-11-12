// @ts-nocheck
import type React from 'react';
import { Component, PureComponent } from 'react';

/**
 * Vendored from react-color to drop CJS-only `reactcss` dependency.
 */
const DEFAULT_ARROW_OFFSET = 1;
const UP_KEY_CODE = 38;
const DOWN_KEY_CODE = 40;
const VALID_KEY_CODES = [UP_KEY_CODE, DOWN_KEY_CODE];
const isValidKeyCode = (keyCode: number) => VALID_KEY_CODES.indexOf(keyCode) > -1;
const getNumberValue = (value: any) => Number(String(value).replace(/%/g, ''));

let idCounter = 1;

export class EditableInput extends (PureComponent || Component) {
  constructor(props) {
    super(props);
    this.state = {
      value: String(props.value).toUpperCase(),
      blurValue: String(props.value).toUpperCase()
    };
    this.inputId = `rc-editable-input-${idCounter++}`;
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.value !== this.state.value &&
      (prevProps.value !== this.props.value || prevState.value !== this.state.value)) {
      if (this.input === document.activeElement) {
        this.setState({ blurValue: String(this.props.value).toUpperCase() });
      } else {
        this.setState({
          value: String(this.props.value).toUpperCase(),
          blurValue: !this.state.blurValue && String(this.props.value).toUpperCase()
        });
      }
    }
  }

  componentWillUnmount() {
    this.unbindEventListeners();
  }

  getValueObjectWithLabel(value) {
    return { [this.props.label]: value };
  }

  getArrowOffset() {
    return this.props.arrowOffset || DEFAULT_ARROW_OFFSET;
  }

  handleBlur = () => {
    if (this.state.blurValue) {
      this.setState({ value: this.state.blurValue, blurValue: null });
    }
  }

  handleChange = (e) => {
    this.setUpdatedValue(e.target.value, e);
  }

  handleKeyDown = (e) => {
    // In case `e.target.value` is a percentage remove the `%` character and update accordingly.
    // https://github.com/casesandberg/react-color/issues/383
    const value = getNumberValue(e.target.value);
    if (!isNaN(value) && isValidKeyCode(e.keyCode)) {
      const offset = this.getArrowOffset();
      const updatedValue = e.keyCode === UP_KEY_CODE ? value + offset : value - offset;
      this.setUpdatedValue(updatedValue, e);
    }
  }

  handleDrag = (e) => {
    if (this.props.dragLabel) {
      const newValue = Math.round(this.props.value + e.movementX);
      if (newValue >= 0 && newValue <= this.props.dragMax) {
        this.props.onChange && this.props.onChange(this.getValueObjectWithLabel(newValue), e);
      }
    }
  }

  handleMouseDown = (e) => {
    if (this.props.dragLabel) {
      e.preventDefault();
      this.handleDrag(e);
      window.addEventListener('mousemove', this.handleDrag);
      window.addEventListener('mouseup', this.handleMouseUp);
    }
  }

  handleMouseUp = () => {
    this.unbindEventListeners();
  }

  unbindEventListeners = () => {
    window.removeEventListener('mousemove', this.handleDrag);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  setUpdatedValue(value, e) {
    const onChangeValue = this.props.label ? this.getValueObjectWithLabel(value) : value;
    this.props.onChange && this.props.onChange(onChangeValue, e);
    this.setState({ value });
  }

  render() {
    const propStyle = this.props.style || {};
    const styles = {
      wrap: { position: 'relative', ...(propStyle.wrap || {}) },
      input: { ...(propStyle.input || {}) },
      label: { ...(propStyle.label || {}), ...(this.props.dragLabel ? { cursor: 'ew-resize' } : {}) }
    };

    return (
      <div style={styles.wrap}>
        <input
          id={this.inputId}
          style={styles.input}
          ref={(input) => { this.input = input; }}
          value={this.state.value}
          onKeyDown={this.handleKeyDown}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          placeholder={this.props.placeholder}
          spellCheck="false"
        />
        {this.props.label && !this.props.hideLabel ? (
          <label htmlFor={this.inputId} style={styles.label} onMouseDown={this.handleMouseDown}>
            {this.props.label}
          </label>
        ) : null}
      </div>
    );
  }
}

export default EditableInput;
