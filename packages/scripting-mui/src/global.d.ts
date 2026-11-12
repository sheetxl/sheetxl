// Declare global variables for TypeScript and VSCode.

// The bundled default-language (`en`) locale floor, inlined by config/vite-plugin-locale-bundle.ts
// (the `virtual:sheetxl/bundled-locale` import). Content comes from this package resources/locales/en.
declare module "virtual:sheetxl/bundled-locale" {
  export const messages: Record<string, string>;
  export const catalogs: { sourceId: string; catalog: any }[];
}
