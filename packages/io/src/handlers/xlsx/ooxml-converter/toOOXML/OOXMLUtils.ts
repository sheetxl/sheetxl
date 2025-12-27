import { CommonUtils } from '@sheetxl/sdk';

let ID_L_LIMIT = 200000000;
let ID_U_LIMIT = 300000000;
let LAST_ID = null;

const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

export const getAxisID = (): number => {
  if (LAST_ID === null || LAST_ID === undefined)
    LAST_ID = getRandomInt(ID_L_LIMIT, ID_U_LIMIT);
  else
    LAST_ID = LAST_ID + 1;

  if (LAST_ID > ID_U_LIMIT)
    LAST_ID = LAST_ID - 10000;

  return LAST_ID;
}

export const isMultiLevel = (objChartSeries: any, pointCoord: any): boolean => {
  let isMultiLevel:boolean = false;
  const arraylength:number = objChartSeries.renderedPoints.length;
  for (let i=0; i<arraylength; i++) {
    let point  = objChartSeries.renderedPoints[i];
    let pointCoordProp = point.getPropertyValue(pointCoord);
    if (pointCoordProp?.value?.asCells?.length > 0 && pointCoordProp.value.asCells[0].length > 1) {
      isMultiLevel = true;
    }
  }
  return isMultiLevel;
}

export function getValues(objChartSeries, pointCoord, isMultiLevel: boolean=false) {
  if (isMultiLevel) {
    return getMultiLevelValues(objChartSeries, pointCoord);
  } else {
    return getSingleLevelValues(objChartSeries, pointCoord);
  }
}

export function getMultiLevelValues(objChartSeries, pointCoord) {
  const values = [];
  const arraylength = objChartSeries.renderedPoints.length;
  for (let i=0; i<arraylength; i++) {
    let point  = objChartSeries.renderedPoints[i];
    let pointCoordProp = point.getPropertyValue(pointCoord);
    if (pointCoordProp?.value?.asCells?.length > 0 && pointCoordProp.value.asCells[0].length > 0) {
      values[i] = [];
      let col = 0
      for (let j=pointCoordProp.value.asCells[0].length; j>0; j--) {//process in reverse order
        let cell = pointCoordProp.value.asCells[0][j-1];
        values[i][col++] = {"value":cell ? cell.value : null, "index":i};
      }
    }
  }

  return {
    isNumericList : false,
    values : CommonUtils.transpose(values),
    formatCodes :  new Map(),
    listFormatCode : null,
    allSameFormatCodes : true
  };
}

function getSingleLevelValues(objChartSeries, pointCoord) {
  let values = [];
  values[0] = [];//make it a 2D array
  let formatCodes = new Map();
  let allSameFormatCodes = true;
  let prevFormatCode = null;
  let isNumericList = true;
  let arraylength = objChartSeries.renderedPoints.length;
  for (let i=0; i<arraylength; i++) {
    let point  = objChartSeries.renderedPoints[i];
    //format code
    let formatCode = null;
    let pointCoordProp = point.getPropertyValue(pointCoord);
    if (pointCoordProp?.value?.asCells?.length > 0 &&
      pointCoordProp.value.asCells[0].length > 0 &&
      pointCoordProp.value.asCells[0][0]) {
      formatCode = pointCoordProp.value.asCells[0][0].z;
      if (!formatCode)
        formatCode = "General";
      formatCodes.set(i, formatCode);
      values[0].push({"value":pointCoordProp.value.asCells[0][0].v, "index":i});
      isNumericList = isNumericList && (pointCoordProp.value.asCells[0][0].t === 'n');
    }
    if (prevFormatCode && formatCode !== null)
      allSameFormatCodes = allSameFormatCodes && (prevFormatCode === formatCode);
    prevFormatCode = formatCode;
  }

  // let listFormatCode = null;
  if (formatCodes.size > 1) {
    let entryCount = 0;
    for (let [_index, formatCode] of formatCodes) {
      if (entryCount++ === 1) {
        return {
          isNumericList : isNumericList,
          values : values,
          formatCodes : formatCodes,
          listFormatCode : formatCode,
          allSameFormatCodes : allSameFormatCodes
        };
      }
    }
  } else if (formatCodes.size === 1) {
    // let entryCount = 0;
    for (let [_index, formatCode] of formatCodes) {
        return {
          isNumericList : isNumericList,
          values : values,
          formatCodes : formatCodes,
          listFormatCode : formatCode,
          allSameFormatCodes : allSameFormatCodes
        };
    }
  } else { // 0
    return {
      isNumericList : isNumericList,
      values : values,
      formatCodes : formatCodes,
      listFormatCode : null,
      allSameFormatCodes : true
    };
  }
}

export function createDataList(execContext, values, xmlNode, setFormatCodes: boolean=false, formatCodes: Map<number, string>=null): void {
  for (let i=0; i<values.length; i++) {
    if (!values[i].value)
      continue;
    let xmlPtNode = execContext.createChildNode(xmlNode, "c:pt");
    execContext.setAttribute(xmlPtNode, "idx", values[i].index);
    if (setFormatCodes)
        execContext.setAttribute(xmlPtNode, "formatCode", formatCodes.get(values[i].index));
    let xmlVNode = execContext.createChildNode(xmlPtNode, "c:v");
    let xmlValueNode = execContext.createTextNode(values[i].value);
    execContext.appendChildNode(xmlVNode, xmlValueNode);
  }
}

export function getDPt(execContext, dPtNodes, idx: number) {
  if (!dPtNodes)
    return;
  const dPtLength = dPtNodes.length;
  for (let i=0; i<dPtLength; i++) {
    let dPtNode = dPtNodes.item(i);
    let idxNode = execContext.getNode(dPtNode, "c:idx");
    let idxVal = idxNode.getAttribute("val");
    if (idxVal === idx.toString()) {
      return dPtNode;
    }
  }
}

// copied from ChartUtils
export const builtInDisplayUnitsKeys = [
  "none",
  "hundreds",
  "thousands",
  "tenThousands",
  "hundredThousands",
  "millions",
  "tenMillions",
  "hundredMillions",
  "billions",
  "trillions",
];

export const builtInDisplayUnits = { // : { description: string, multi: number } =
  none: { description: "None", multi: 1 },
  hundreds: { description: "Hundreds", multi: 100 },
  thousands: { description: "Thousands", multi: 1000 },
  tenThousands: { description: "10000", multi: 10000 },
  hundredThousands: { description: "100000", multi: 100000 },
  millions: { description: "Millions", multi: 1000000 },
  tenMillions: { description: "10000000", multi: 10000000 },
  hundredMillions: { description: "100000000", multi: 100000000 },
  billions: { description: "Billions", multi: 1000000000 },
  trillions: { description: "Trillions", multi: 10000000000 },
};

export const isLineType = (chartType: string): boolean => {
  if (chartType === "line" || chartType === "line3D" || chartType === "scatter")
    return true;

  return false;
};

/**
 * Create a string from an array of cells.
 * @param cells
 * @param separator
 * This is being used by OOXML import from the charting code. Not sure what it is doing but it's incorrectly.
 */
export const stringFromCells = (cells: any[], separator=" "): string => {
  let retValue = "";
  let flattened = flatten2DArray(cells);
  for (let i = 0; i < flattened.length; i++) {
    let input = flattened[i].toText();
    retValue += input;
    if (i < flattened.length - 1) retValue += separator;
  }
  return retValue;
}

/**
 * Rolls a potential 2d array into a single array.
 * @param array
 *
 * @remarks
 * This is not recursive and only handles arrays of 2 levels deep.
 */
export function flatten2DArray<T=any>(array: readonly T[]): T[] {
  if (!array)
      return null;
  let retValue = [];
  for (let i=0; i<array.length; i++) {
    const itemAsArray = array[i];
    if (Array.isArray(itemAsArray)) {
      for (let j=0; j<itemAsArray.length; j++) {
        retValue.push(itemAsArray[j]);
      }
    } else {

    }
  }
  return retValue;
}
