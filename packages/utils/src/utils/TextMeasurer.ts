import { PaintableText, Size } from '../types';

/**
 * Simple DOM element to measure text size for non-rich text.
 * Supports text wrapping and letterSpacing based on HTML spans
 *
 * Usage
 *
 * ```
 * const textMeasurer = new TextMeasurer()
 * textMeasurer.naturalBounds('Hello world').width
 * ```
 */

// TODO - check can I use dom? Ultimately we are going to replace this with our custom text layout
export interface TextMeasurerOptions {
  maxWidth?:number;
  lineHeight?: string; // if not specified then derived from fontSize
  paintableText?: PaintableText;

  scale?: number;
}

export interface TextDimensions extends Size {
  maxLineHeight: number;
}
export interface TextMeasurer {
  naturalDimensions: (text: string, options?: TextMeasurerOptions) => TextDimensions;
}
