/**
 * Props for LoadingPanel
 */
export interface LoadingPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A delay for showing the loading panel.
   *
   * @remarks
   * This helps prevent flicker if loading is very fast.
   */
  transitionDelay?: string;
  /**
   * Whether the background should be transparent.
   *
   * @defaultValue false
   */
  transparentBackground?: boolean;

  /**
   * Optional callback when mounted
   */
  onMount?: () => void;
  /**
   * Optional callback when unmounted
   */
  onUnmount?: () => void;
  /**
   * Ref to the element.
   */
  ref?: React.Ref<HTMLDivElement>;
}