/**
 * @internal
 */
type ReactModule = typeof import('react');
/**
 * Reference to StudioMUI module.
 *
 * [@sheetxl/studio-mui](./modules/_sheetxl_studio-mui.html)
 */
type StudioMUIModule = typeof import('@sheetxl/studio-mui');

export interface ResolvedDependencies {
  React: ReactModule; // React instance, if needed
  ReactJSXTransform: any; // React JSX Transform instance, if needed
  ReactDOM: any; // ReactDOM instance, if needed
  ReactDOMClient: any; // ReactDOMClient instance, if needed
  StudioMUI: StudioMUIModule; // StudioMUI instance, if needed
}