// @ts-nocheck
 
import tinycolor from 'tinycolor2';

import { EditableInput } from './EditableInput';

/**
 * Vendored from react-color to drop CJS-only `reactcss` dependency.
 */
const isValidHex = (hex) => {
  if (hex === 'transparent') {
    return true;
  }
  // disable hex4 and hex8
  const lh = String(hex).charAt(0) === '#' ? 1 : 0;
  return hex.length !== 4 + lh && hex.length < 7 + lh && tinycolor(hex).isValid();
};

export const SketchFields = ({ onChange, rgb, hsl, hex, disableAlpha }) => {
  const styles = {
    fields: {
      display: 'flex',
      paddingTop: '4px'
    },
    single: {
      flex: '1',
      paddingLeft: '6px'
    },
    alpha: {
      flex: '1',
      paddingLeft: '6px',
      ...(disableAlpha ? { display: 'none' } : {})
    },
    double: {
      flex: '2'
    },
    input: {
      width: '80%',
      padding: '4px 10% 3px',
      border: 'none',
      boxShadow: 'inset 0 0 0 1px #ccc',
      fontSize: '11px'
    },
    label: {
      display: 'block',
      textAlign: 'center',
      fontSize: '11px',
      color: '#222',
      paddingTop: '3px',
      paddingBottom: '4px',
      textTransform: 'capitalize'
    }
  };

  const handleChange = (data, e) => {
    if (data.hex) {
      isValidHex(data.hex) && onChange({
        hex: data.hex,
        source: 'hex'
      }, e);
    } else if (data.r || data.g || data.b) {
      onChange({
        r: data.r || rgb.r,
        g: data.g || rgb.g,
        b: data.b || rgb.b,
        a: rgb.a,
        source: 'rgb'
      }, e);
    } else if (data.a) {
      if (data.a < 0) {
        data.a = 0;
      } else if (data.a > 100) {
        data.a = 100;
      }
      data.a /= 100;
      onChange({
        h: hsl.h,
        s: hsl.s,
        l: hsl.l,
        a: data.a,
        source: 'rgb'
      }, e);
    }
  };

  return (
    <div style={styles.fields} className="flexbox-fix">
      <div style={styles.double}>
        <EditableInput
          style={{ input: styles.input, label: styles.label }}
          label="hex"
          value={hex.replace('#', '')}
          onChange={handleChange}
        />
      </div>
      <div style={styles.single}>
        <EditableInput
          style={{ input: styles.input, label: styles.label }}
          label="r"
          value={rgb.r}
          onChange={handleChange}
          dragLabel="true"
          dragMax="255"
        />
      </div>
      <div style={styles.single}>
        <EditableInput
          style={{ input: styles.input, label: styles.label }}
          label="g"
          value={rgb.g}
          onChange={handleChange}
          dragLabel="true"
          dragMax="255"
        />
      </div>
      <div style={styles.single}>
        <EditableInput
          style={{ input: styles.input, label: styles.label }}
          label="b"
          value={rgb.b}
          onChange={handleChange}
          dragLabel="true"
          dragMax="255"
        />
      </div>
      <div style={styles.alpha}>
        <EditableInput
          style={{ input: styles.input, label: styles.label }}
          label="a"
          value={Math.round(rgb.a * 100)}
          onChange={handleChange}
          dragLabel="true"
          dragMax="100"
        />
      </div>
    </div>
  );
};

export default SketchFields;
