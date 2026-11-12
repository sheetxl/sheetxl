// Minimal ambient shim for the untyped `tinycolor2` dependency (no @types package installed).
// The color-picker code uses it dynamically, so `any` is the honest surface here.
declare module 'tinycolor2' {
  const tinycolor: any;
  export default tinycolor;
}
