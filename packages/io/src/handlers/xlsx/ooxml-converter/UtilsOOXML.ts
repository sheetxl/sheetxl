import type { FromOOXMLConverter } from './FromOOXMLConverter';
import type { ConvertFromOptions } from './OOXMLTypes'

import { IColor } from '@sheetxl/sdk';

/**
 * Arc2D angles are skewed, OOXML aren't ... so we need to unskew them.
 *
 * a = height/width of bounding box
 * angle_ooxml = ATAN(a * TAN(angle_arc2d))
 *
 * Furthermore ooxml angle starts at the X-axis and increases clock-wise,
 * where as Arc2D api states
 * "45 degrees always falls on the line from the center of the ellipse to the upper right corner of the framing rectangle"
 * so we need to reverse it
 *
 * AWT:                         OOXML:
 *            |90/-270                     |270/-90 (16200000)
 *            |                            |
 * +/-180-----------0           +/-180-----------0
 *            |               (10800000)   |
 *            |270/-90                     |90/-270 (5400000)
 *
 * Furthermore ooxml angle is degree * 60000
 *
 * @see
 * <a href="http://www.onlinemathe.de/forum/Problem-bei-Winkelberechnungen-einer-Ellipse">unskew angle</a>
 **/
export const convertOoxml2AwtAngle = (ooAngle: number, width: number, height: number): number => {
  const aspect = (height / width);
  // reverse angle for awt
  let awtAngle = -ooAngle;
  // normalize angle, in case it's < -360 or > 360 degrees
  let awtAngle2 = awtAngle % 360.0;
  let awtAngle3 = awtAngle - awtAngle2;
  // because of tangents nature, the values left [90-270] and right [270-90] of the axis are mirrored/the same
  // and the result of atan2 need to be justified
  switch ((awtAngle2 / 90)) {
    case -3:
      // -270 to -360
      awtAngle3 -= 360;
      awtAngle2 += 360;
      break;
    case -2:
    case -1:
      // -90 to -270
      awtAngle3 -= 180;
      awtAngle2 += 180;
      break;
    default:
    case 0:
      // -90 to 90
      break;
    case 2:
    case 1:
      // 90 to 270
      awtAngle3 += 180;
      awtAngle2 -= 180;
      break;
    case 3:
      // 270 to 360
      awtAngle3 += 360;
      awtAngle2 -= 360;
      break;
  }

  // skew
  awtAngle = toDegrees(Math.atan2(Math.tan(toRadians(awtAngle2)), aspect)) + awtAngle3;
  return awtAngle;
}

const toRadians = (deg: number):number => {
  return deg / 180.0 * Math.PI;
}

const toDegrees = (rad: number): number => {
  return rad * 180.0 / Math.PI;
}

export interface DomParser {
  parseFromString(xmlSource: string, mimeType?: string): Document;
}

export interface FileLookup {
  // TODO - this is also typed. has content and name
  (location: string): any;
}

export interface OOXMLRelationShip {
  target: string;
  // type
  // isExternal
}

export const readAsBinary = (location: string, getFile: FileLookup, onWrite?: (buffer: ArrayBuffer) => any, options: ConvertFromOptions=null): any => { /* () => Uint8Array */
  if (!location) return null;
  let lookupLocation = location;
  if (lookupLocation.startsWith('/')) {
    lookupLocation = lookupLocation.substring(1);
  }
  let cached = options?.parsedRefs?.get(location);
  if (cached !== undefined) return cached;

  const file = getFile(lookupLocation);
  if (!file) return null;
  let retValue = file.content;
  try {
    if (onWrite) {
      retValue = onWrite(retValue);
    }
  } catch (error: any) {
    console.warn(error);
  }
  options?.parsedRefs?.set(location, retValue);
  return retValue;
};

// Usage example in readAsJSON:
export const readAsJSON = (location: string, getFile: FileLookup, domParser: DomParser, fromOOXMLConverter: FromOOXMLConverter, options: ConvertFromOptions=null): any => {
  if (!location) return null;
  let lookupLocation = location;
  if (lookupLocation.startsWith('/')) {
    lookupLocation = lookupLocation.substring(1);
  }
  let cached = options?.parsedRefs?.get(location);
  if (cached !== undefined) return cached;

  const file = getFile(lookupLocation);
  if (!file) return null;
  const fileBuffer = file.content;
  try {
    const asString = new TextDecoder().decode(fileBuffer);
    const asDom = domParser.parseFromString(asString, 'text/xml');
    const asJSON = fromOOXMLConverter.convert(asDom, location, options);
    options?.parsedRefs?.set(location, asJSON);
    return asJSON;
  } catch (error: any) {
    console.warn(error);
  }

  return null;
};

export const parseRels = (location: string, getFile: FileLookup, domParser: DomParser, fromOOXMLConverter: FromOOXMLConverter, options: ConvertFromOptions=null): Map<string, OOXMLRelationShip> => {
  if (!location) return null;

  const asJSON = readAsJSON(location, getFile, domParser, fromOOXMLConverter, options);
  if (!asJSON) return null;
  const mapRels = new Map<string, OOXMLRelationShip>();
  const keys = Object.keys(asJSON);
  const keysLength = keys.length;
  for (let k=0; k<keysLength; k++) {
    const key = keys[k];
    const rel = asJSON[key];
    mapRels.set(key, rel);
  }
  return mapRels;
}

export const readAsJSONs = (dirKey: string, xlsxWB: any, domParser: DomParser, fromOOXMLConverter: FromOOXMLConverter, options: ConvertFromOptions=null): Map<string, any> => {
  const retValue:Map<string, any> = new Map();
  let locations = (xlsxWB as any).Directory[dirKey];
  const locationsLength = locations ? locations.length : 0;
  for (let i=0; i<locationsLength; i++) {
    const location = locations[i];
    if (!location) continue;
    let lookupLocation = location;
    if (lookupLocation.startsWith('/')) {
      lookupLocation = lookupLocation.substring(1);
    }
    const getFile = (loc: string) => (xlsxWB as any).files[loc];
    const asJSON = readAsJSON(lookupLocation, getFile, domParser, fromOOXMLConverter, options);
    retValue.set(lookupLocation, asJSON);
  }

  return retValue;
};

export const resolveRelatives = (path: string): string => {
  const pathSegments = path.split(/\/+/);
  const normalizedSegments = pathSegments.reduce((acc: string[], elem: string, index: number) => {
    if (elem === '.') {
      acc.splice(index, 1); // remove the current element
    } else if (elem === '..') {
      acc.splice(index - 1, 2); // remove the current element
    }
    return acc;
  }, pathSegments);

  // Join normalized segments back into a path
  return normalizedSegments.join('/');
}


export const uint8ArrayToReader = (uint8Array: Uint8Array): ReadableStreamDefaultReader<Uint8Array> => {
  let offset = 0;

  // Create the ReadableStream from the Uint8Array
  const readableStream = new ReadableStream({
    pull(controller) {
      if (offset < uint8Array.length) {
        // Create a chunk of data to be read (e.g., 1024 bytes per chunk)
        const chunk = uint8Array.subarray(offset, Math.min(offset + 1024, uint8Array.length));
        controller.enqueue(chunk); // Enqueue the chunk
        offset += chunk.length; // Move the offset forward
      } else {
        controller.close(); // Close the stream when done
      }
    }
  });

  // Return the ReadableStreamDefaultReader
  return readableStream.getReader();
}

const ensureReadableStream = async () => {
  // Check if ReadableStream exists in the global context
  if (typeof ReadableStream === 'undefined') {
    if (typeof window === 'undefined') {
      // We are in a Node.js environment; dynamically import the polyfill
      const { ReadableStream } = await import('web-streams-polyfill');
      if (__DEV__) {
        console.log('Using ReadableStream polyfill...');
      }
      (globalThis as any).ReadableStream = ReadableStream;
    } else {
      // We are in a browser, and ReadableStream is not available (older browser)
      console.warn("Browser does not support ReadableStream; consider loading a polyfill.");
    }
  }
}

/**
 * Create a reader stream from a 'bufferLike' (ArrayBuffer or Uint8Array).
 *
 * @param bufferLike - The buffer-like object to convert to a stream.
 * @param chunkSize - the chunk size for reading the buffer-like object. Default Value 8mb
 * @returns A Promise<ReadableStreamDefaultReader> that reads the buffer-like object.
 */
export const arrayBufferToStringStream = async (
  bufferLike: ArrayBuffer | Uint8Array,
  chunkSize: number = 8 * 1024 * 1024
): Promise<ReadableStreamDefaultReader<string>> => {
  await ensureReadableStream();

  const decoder = new TextDecoder('utf-8'); // Streaming UTF-8 decoder
  let offset:number = 0;
  const buffer = bufferLike instanceof Uint8Array ? bufferLike : new Uint8Array(bufferLike);
  const stream = new ReadableStream<string>({
    pull(controller) {
      if (offset >= buffer.byteLength) {
        controller.close();
        return;
      }

      // Slice a chunk from the buffer and decode
      const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.byteLength));
      const stringChunk = decoder.decode(chunk, { stream: offset + chunkSize < buffer.byteLength });
      controller.enqueue(stringChunk);
      offset += chunk.length;
    }
  });

  // Get a ReadableStreamDefaultReader from the stream
  return stream.getReader();
}

/* Even though theme layout is (usually) dk1 lt1 dk2 lt2, true order is lt1 dk1 lt2 dk2 */
const THEME_COLOR_ORDER = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

/**
 * Slightly different than drawML. Rationalize.
 */
export const processDataBarColor = (
  getAttribute: (name: string) => string,
  auto: string='dk1'
): string => {
  let strColor:string;

  const attrAuto:string = getAttribute("auto");
  if ((attrAuto !== undefined && (attrAuto === "1" || attrAuto === "true"))) {
    strColor = auto; //Scheme.dk1; // TODO - what color is auto? This is the same as unspecified?
  }

  const indexed = getAttribute("indexed");
  if (indexed) {
    strColor = `index${indexed}`;
  }
  const rgb = getAttribute("rgb");
  if (rgb) {
    strColor = rgb.toLowerCase();
    // Note - Excel doesn't support alpha and some tools generate rgba colors with a 0 alpha. Excel converts these so we do too.
    if (rgb.length === 8 && !rgb.startsWith('FF')) {
      strColor = 'FF' + rgb.substring(2, rgb.length);
    }
  }

  const theme = getAttribute("theme");
  if (theme) {
    strColor = THEME_COLOR_ORDER[theme];
  }
  let tint:string | number | null = getAttribute("tint");
  if (tint) {
    strColor += ` ${IColor.AdjustmentType.ETint} ${parseFloat(tint)}`;
  }

  if (!strColor) {
    return undefined;
  }

  return strColor;
}

/**
 * If the text has a leading and trailing curly braces, remove them.
 */
export const removeCurlyBraces = (text: string): string => {
  if (!text) return text;
  const cleaned = text.replace(/^\{([\s\S]+)\}$/, '$1');
  return cleaned;
}
