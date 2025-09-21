
/**
 * Interface for serializing objects to and from JSON.
 */
export interface JSONSerializable<J> {
  /**
   * Save internal state to JSON
   */
  toJSON(): J;

  /**
   * Load internal state from json
   */
  fromJSON(json: J): void;
}

/**
 * Interface to indicate that an item has a toJSON but that it is async.
 */
export interface JSONSerializableAsync<J> {
  /**
   * Asynchronously serialize the item to JSON.
   *
   * @returns A promise that resolves to the JSON representation of the item.
   */
  toJSONAsync: () => Promise<J> | J;
}

/**
 * Options for retrieving resources using fetch.
 */
export interface FetchArgs {
  /**
   * The input to fetch, which can be a string URL, a URL object, or a Request object.
   */
  input: string | URL | Request;
  /**
   * The options for the fetch request.
   */
  init?: RequestInit;

  /**
   * Timeout in milliseconds for fetch operations.
   *
   * When the source is a URL or FetchArgs, this timeout will be applied.
   * If the fetch operation takes longer than this timeout, it will be aborted.
   *
   * @default 30000 (30 seconds)
   */
  timeout?: number; // in milliseconds
}

/**
 * Represents a top-left coordinate in a 2D space.
 *
 * @remarks
 * This is similar to a Point but has a left, top to align with Rectangle.
 */
export interface TopLeft {
  /**
   * The x coordinate of the top-left corner.
   */
  left: number;
  /**
   * The y coordinate of the top-left corner.
   */
  top: number;
};

/**
 * Represents a point in 2D space.
 */
export interface Point {
  /**
   * The x coordinate of the point.
   */
  x: number;
  /**
   * The y coordinate of the point.
   */
  y: number;
};

/**
 * Represents a shape that has a width and height.
 */
export interface Size {
  /**
   * The width of the shape.
   */
  width: number;
  /**
   * The height of the shape.
   */
  height: number;
};

/**
 * Represents a point with size.
 */
export interface Bounds extends Point, Size {}

/**
 * Flags for indicating which size properties are set.
 */
export interface DimensionsFlags {
  /**
   * Indicates if the width is set.
   */
  width: boolean;
  /**
   * Indicates if the height is set.
   */
  height: boolean;
};


/**
 * Represents a rectangle with left, top, right, and bottom coordinates.
 */
export interface Rectangle {
  /**
   * The left coordinate of the rectangle.
   */
  left: number;
  /**
   * The top coordinate of the rectangle.
   */
  top: number;
  /**
   * The right coordinate of the rectangle.
   */
  right: number;
  /**
   * The bottom coordinate of the rectangle.
   */
  bottom: number;
}

/**
 * Indicates a direction along an axis.
 */
export const Direction = {
  /**
   * Indicates an upward direction.
   */
  Up: 'up',
  /**
   * Indicates a downward direction.
   */
  Down: 'down',
  /**
   * Indicates a leftward direction.
   */
  Left: 'left',
  /**
   * Indicates a rightward direction.
   */
  Right: 'right'
} as const;
export type Direction = typeof Direction[keyof typeof Direction];


export interface AxisOrientationFlags {
  vertical: boolean;
  horizontal: boolean;
}

export const AnchorLocation = {
  TopLeft: 'tl',
  Top: 't',
  TopRight: 'tr',
  Left: 'l',
  Center: 'c',
  Right: 'r',
  BottomLeft: 'bl',
  Bottom: 'b',
  BottomRight: 'br'
} as const;
export type AnchorLocation = typeof AnchorLocation[keyof typeof AnchorLocation];

export const MimeType = {
  html: 'text/html',
  plain: 'text/plain',
  png: 'image/png'
  // csv: 'text/csv',
  // json: 'text/json',
} as const
export type MimeType = typeof MimeType[keyof typeof MimeType];

/**
 * A callback that is returned by listeners. To remove the listener.
 */
export interface RemoveListener {
  (): void;
}

// export interface LineSegment {
//   offset: number;
//   length: number;
// }

export interface PaintableSurface {
  fill?: string;
  strokeFill?: string;
  strokeWidth?: number;
}

export interface PaintableText extends PaintableSurface {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  letterSpacing?: number;
  decoration?: string;

  align?: string; // show enums
  vAlign?: string; // show enums
  wrap?: string; // "wrap",
  width?: number; // width of the text. Required for overflow
}

/*
 * Acts like partial but recursively applies to all properties.
 */
// TODO - doesn't work in many cases
// export type DeepPartial<T> = {
//   [P in keyof T]?: DeepPartial<T[P]>;
// };

// export type DeepPartial<T> = T extends Function ? T : (T extends object ? { [P in keyof T]?: DeepPartial<T[P]>; } : T);
// // export type DeepPartial<T> = {
// //   [P in keyof T]?:
// //     T[P] extends (infer U)[] ? DeepPartial<U>[] :
// //     T[P] extends object | undefined ? DeepPartial<T[P]> :
// //     T[P];
// // };