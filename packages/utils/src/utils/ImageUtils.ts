import { Size } from '../types';

export const DATA_URL_PNG_PREFIX: string = 'data:image/png;base64,';


const MESSAGE_ERROR_IMAGE = `Unable to resolve image.`;
/**
 * Returns the natural size and ensure that the image is loadable.
 */
const getImageNaturalDimensions = (asUrl: string): Promise<Size> => {
  return new Promise(async (resolve, reject) => {
    let elemImg = null;
    try {
      // TODO - Is there a node implementation of this?
      elemImg = new Image();
      elemImg.src = asUrl;
      elemImg.addEventListener('load', function() {
        resolve({ width: elemImg.naturalWidth, height: elemImg.naturalHeight });
      }, { once: true});
      elemImg.addEventListener('error', function() {
        URL.revokeObjectURL(asUrl);
        reject("Invalid Image");
      }, { once: true});
      await elemImg.decode('sync');
    } catch (error: any) {
      if (elemImg?.src) {
        URL.revokeObjectURL(elemImg.src);
      }
    }

    if (!elemImg) {
      reject(MESSAGE_ERROR_IMAGE);
    }
  });
}

export const getImageDataUrl = (asUrl: string, quality: number=1): Promise<{ elemImg: HTMLImageElement, dataUrl: string}> => {
  return new Promise(async (resolve, reject) => {
    let elemImg = null;
    try {
      // TODO - Is there a node implementation of this?
      elemImg = new Image();
      elemImg.src = asUrl;
      elemImg.addEventListener('load',  function() {
        try{
          const canvas = document.createElement('canvas');
          canvas.width = elemImg.naturalWidth;
          canvas.height = elemImg.naturalHeight;
          // Get '2d' context and draw the image.
          const ctx = canvas.getContext("2d");
          ctx.drawImage(elemImg, 0, 0);
          // Get canvas data URL
          const data = canvas.toDataURL('image/png', quality);
          resolve({ elemImg, dataUrl: data });
        } catch(e){
          URL.revokeObjectURL(asUrl);
          reject(e);
        }
      }, { once: true});
      elemImg.addEventListener('error', function() {
        URL.revokeObjectURL(asUrl);
        reject("Invalid Image");
      }, { once: true});
      await elemImg.decode('sync');
    } catch (error: any) {
      if (elemImg?.src) {
        URL.revokeObjectURL(elemImg.src);
      }
    }

    if (!elemImg) {
      reject(MESSAGE_ERROR_IMAGE);
    }
  });
}

export interface IImageDetails {
  mimeType: string;
  naturalSize: Size;
  asUrl: string;

  asSVGText?: string;
}
const MIME_TYPE_IMAGE = 'image/*';
const MIME_TYPE_SVG = 'image/svg+xml';

export const loadImageDetails = async (arrayBuffer: ArrayBuffer, mimeType: string=null): Promise<IImageDetails> => {
  let details:IImageDetails = null;
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
  } else if (mimeType.startsWith('image/')) {
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
