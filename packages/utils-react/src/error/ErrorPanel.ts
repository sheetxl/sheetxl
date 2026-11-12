/**
 * Props for an Error Panel
 */
export interface ErrorPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The error to show
   */
  error: any;
  /**
   * Ref to the element.
   */
  ref?: React.Ref<HTMLDivElement>;
}