/** @internal */
export type ReactModule = typeof import('react');
/** @internal */
export type ReactDOMRoot = import('react-dom/client').Root;

/**
 * Reference to StudioMUI module.
 *
 * [@sheetxl/studio-mui](../modules/_sheetxl_studio-mui.html)
 */
export type StudioMUIModule = typeof import('@sheetxl/studio-mui');

/**
 * Reference to StudioProps.
 *
 * @link [StudioProps](../interfaces/_sheetxl_studio-mui.StudioProps.html)
 */
export type StudioProps = import('@sheetxl/studio-mui').StudioProps;

/**
 * Reference to IWorkbookElement.
 *
 * @link [IWorkbookElement](../interfaces/_sheetxl_studio-mui.IWorkbookElement.html)
 */
export type StudioElement = import('@sheetxl/studio-mui').StudioElement;

/**
 * Dependencies that are resolved. These are defaulted
 * but can be overwritten with either URLs or actual instances.
 */
export interface Dependencies {
  reactUrl?: string; // || ReactModule
  reactDomUrl?: string; // || ReactDOMRoot
  reactDomUrlClient?: string; // || ReactDOMRoot;
  reactJsxTransform?: string; // || ReactJSXTransform
}

/**
 * All elements attached to a DOM element will have the additional methods
 * from Attached.
 */
export interface Attached<P> {
  /**
   * Updates the properties of the attached SheetXL instance.
   * @param props The new properties to apply.
   * @returns A promise that resolves when the update is complete.
   */
  update: (props: P) => Promise<void>;
  /**
   * Detaches the SheetXL React component from its DOM element.
   *
   * @remarks
   * This will clean up any React roots or event listeners.
   */
  detach: () => Promise<void>;
}

/**
 * Configuration for panels that appear during loading or error states.
 */
export interface PanelConfig {
  /** Custom message to display */
  message?: string;
  /** Custom icon (HTML string or element) */
  icon?: string | HTMLElement;
  /** Custom HTML element to replace the entire panel */
  customElement?: HTMLElement;
  /**
   * Whether to hide the panel. Defaults to `false`.
   *
   * @remarks
   * This maybe set to `true` if a custom loading or error panel is provided.`
   */
  hide?: boolean;
  /** Additional CSS class to apply to panel */
  className?: string;
  /** CSS custom properties for styling the panel */
  cssVars?: {
    /** Text color (--sheetxl-panel-color) */
    color?: string;
    /** Background color (--sheetxl-panel-background) */
    background?: string;
    /** Icon color (--sheetxl-panel-icon-color) */
    iconColor?: string;
  };
}

/**
 * Options for the one-time initialization of the SheetXL library.
 */
export interface InitializationOptions {
  /**
   * If provided, this will be used to attach the SheetXL React component or to
   * provide a loading error panel.
   */
  selector?: string | HTMLElement;

  /**
   * The string identifier for the SheetXL license key.
   *
   * @see
   * {@link https://my.sheetxl.com} to generate a license key.
   */
  licenseKey?: string;

  /**
   * Configuration for the loading panel that appears while SheetXL is loading.
   */
  loading?: PanelConfig;

  /**
   * Configuration for the error panel that appears if there is an error loading SheetXL.
   */
  error?: PanelConfig;

  /**
   * By default, the runtime dependencies are resolved automatically but
   * you can provide your own URLs or instances if needed.
   */
  dependencies?: Dependencies;
}

/**
 * Interface for the SheetXL module that allows for simple javascript integration.
 */
export interface ISheetXL {
  /**
   * Creates a SheetXL workbook component and attaches it to a DOM element.
   *
   * @param selector | InitializationOptions. The CSS selector of the DOM element to attach to (e.g., "#sheetxl").
   * @param props Optional properties to pass to the SheetXL React component.
   * @returns A promise that resolves to a function that, when called, will detach the SheetXL React component from the DOM element.
   */
  // Note - we will create more of these methods as we expose more components via cdn if required
  attachStudio(selector: string | InitializationOptions, props?: StudioProps): Promise<StudioElement & Attached<StudioProps>>;

  /**
   * Initializes the SheetXL runtime with the provided options.
   *
   * @param options The initialization options.
   *
   * @remarks
   * This does not need to be explicity called as `create` methods can also accept this.
   * If this is called more than once all subsequent calls will be ignored.
   */
  initialize(options: InitializationOptions): Promise<void>;
}