
const EMU_PER_POINT = 12700;  // EMU_PER_PIXEL * 1.3

/*
 * https://startbigthinksmall.wordpress.com/2010/01/04/points-inches-and-emus-measuring-units-in-office-open-xml/
 */
const EMU_PER_PIXEL = 9525;

const EMU_PER_ANGLE = 60000;

export const toOOXMLLineCap = (value: string): string => {
  if ("round" === value) {
      return "rnd";
  } else if ("butt" === value) {
      return "flat";
  } else if ("square" === value) {
      return "sq";
  }
  return;
}

export const toOOXMLAlign = (value: string): string => {
  return value;
}

export const toOOXMLCompound = (value: string): string => {
  if ("single" === value) {
      return "sng";
  }
  return value;
}

// SheetXL does not support: rect, shape
export const toOOXMLGradientType = (value: string): string => {
  if (!value)
    return value;
  if (value === "linear") {
    return value;
  }
  if (value === "radial") {
    return "circle"
  }

  return value;
}

export const toOOXMLPoints = (pixels: number): number => {
  return pixels * EMU_PER_POINT;
}

export const toPixelFromEmu = (emu: number): number => {
  return emu / EMU_PER_PIXEL;
}

export const toOOXMLAngle = (deg: number): number => {
  return deg * EMU_PER_ANGLE;
}