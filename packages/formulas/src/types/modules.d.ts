/**
 * Ambient declarations for third-party modules that ship without TypeScript types.
 */
declare module 'bessel' {
  const bessel: {
    besseli(x: number, n: number): number;
    besselj(x: number, n: number): number;
    besselk(x: number, n: number): number;
    bessely(x: number, n: number): number;
  };
  export default bessel;
}
