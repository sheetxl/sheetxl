import { type Size } from '../types';

export const DATA_URL_PNG_PREFIX: string = 'data:image/png;base64,';


const MESSAGE_ERROR_IMAGE = `Unable to resolve image.`;

/**
 * Returns the natural size and ensure that the image is loadable.
 */
const getImageNaturalDimensions = (asUrl: string): Promise<Size> => {
  return new Promise(async (resolve, reject) => {
    let elemImg: HTMLImageElement | null = null;
    try {
      // TODO - Is there a node implementation of this?
      const img = elemImg = new Image();
      img.src = asUrl;
      img.addEventListener('load', function() {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      }, { once: true});
      img.addEventListener('error', function(event: ErrorEvent): any {
        URL.revokeObjectURL(asUrl);
        let message = event?.error?.message ?? '';
        if (message) {
          message = `: ${message}`;
        }
        reject(`Invalid Image${message}`, );
      }, { once: true});
      await img.decode();
    } catch (error: any) {
      if (elemImg?.src) {
        URL.revokeObjectURL(elemImg.src);
      }
    }

    if (!elemImg) {
      reject(new Error(MESSAGE_ERROR_IMAGE));
    }
  });
}

export const getImageDataUrl = (asUrl: string, quality: number=1): Promise<{ elemImg: HTMLImageElement, dataUrl: string}> => {
  return new Promise(async (resolve, reject) => {
    let elemImg: HTMLImageElement | null = null;
    try {
      // TODO - Is there a node implementation of this?
      const img = elemImg = new Image();
      img.src = asUrl;
      img.addEventListener('load',  function() {
        try{
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          // Get '2d' context and draw the image.
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error('Unable to create 2d context');
          ctx.drawImage(img, 0, 0);
          // Get canvas data URL
          const data = canvas.toDataURL('image/png', quality);
          resolve({ elemImg: img, dataUrl: data });
        } catch(e){
          URL.revokeObjectURL(asUrl);
          reject(e);
        }
      }, { once: true});
      img.addEventListener('error', function() {
        URL.revokeObjectURL(asUrl);
        reject("Invalid Image");
      }, { once: true});
      await img.decode();
    } catch (error: any) {
      if (elemImg?.src) {
        URL.revokeObjectURL(elemImg.src);
      }
    }

    if (!elemImg) {
      reject(new Error(MESSAGE_ERROR_IMAGE));
    }
  });
}

export interface IImageDetails {
  mimeType: string;
  naturalSize: Size;
  asUrl: string;

  asSVGText?: string;
}
/** The first 8 bytes of a PNG, as two big-endian words. */
const PNG_SIGNATURE = [0x89504E47, 0x0D0A1A0A];
const PNG_CHUNK_PHYS = 0x70485973;
const PNG_CHUNK_IDAT = 0x49444154;
const CSS_PIXELS_PER_METER = 96 / 0.0254;

/**
 * The size in CSS pixels a PNG states through its density (`pHYs`), which is not its pixel size when
 * it was rendered at another DPI: Excel puts a picture on the clipboard at 150 DPI.
 *
 * @returns `null` when the buffer is not a PNG or states no physical density.
 */
export const getPngStatedSize = (buffer: ArrayBuffer): Size | null => {
  const view = new DataView(buffer);
  if (view.byteLength < 24 || view.getUint32(0) !== PNG_SIGNATURE[0] || view.getUint32(4) !== PNG_SIGNATURE[1]) return null;
  /* pHYs is required to come before the image data, so the walk stops there. */
  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = view.getUint32(offset + 4);
    if (type === PNG_CHUNK_IDAT) return null;
    if (type === PNG_CHUNK_PHYS) {
      if (length !== 9 || offset + 17 > view.byteLength) return null;
      const perMeterX = view.getUint32(offset + 8);
      const perMeterY = view.getUint32(offset + 12);
      const isMeters = view.getUint8(offset + 16) === 1; // otherwise only an aspect ratio
      if (!isMeters || !perMeterX || !perMeterY) return null;
      return {
        width: Math.max(1, Math.round(view.getUint32(16) * CSS_PIXELS_PER_METER / perMeterX)),
        height: Math.max(1, Math.round(view.getUint32(20) * CSS_PIXELS_PER_METER / perMeterY))
      };
    }
    offset += 12 + length;
  }
  return null;
}

const MIME_TYPE_IMAGE = 'image/*'; // TODO png?
const MIME_TYPE_SVG = 'image/svg+xml';

export const loadImageDetails = async (arrayBuffer: ArrayBuffer, mimeType: string | null=null): Promise<IImageDetails> => {
  let details:IImageDetails | null = null;
  const loadImage = async () => {
    try {
      const resolveMimeType = mimeType ?? MIME_TYPE_IMAGE;
      const asUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: resolveMimeType } /* (1) */));
      const naturalSize = await getImageNaturalDimensions(asUrl);
      details = { mimeType: resolveMimeType, naturalSize, asUrl };
    } catch (error: any) {
      // console.warn('Failed to decode image buffer as image', error);
    }
  }
  const loadSvg = async () => {
    try {
      const asSVGText = new TextDecoder().decode(arrayBuffer);
      const asUrl = URL.createObjectURL(new Blob([asSVGText], { type: MIME_TYPE_SVG }));
      const naturalSize = await getImageNaturalDimensions(asUrl);
      details = { mimeType: mimeType ?? MIME_TYPE_SVG, naturalSize, asUrl, asSVGText };
    } catch (error: any) {
      // console.warn('Failed to decode image buffer as svg', error);
    }
  }

  if (mimeType === MIME_TYPE_SVG) {
    await loadSvg();
  } else if (mimeType?.startsWith('image/')) {
    await loadImage();
  } else {
    await loadImage();
    if (!details) {
      await loadSvg();
    }
  }

  if (!details) {
    throw new Error('Failed to load image');
  }
  return details;
}
