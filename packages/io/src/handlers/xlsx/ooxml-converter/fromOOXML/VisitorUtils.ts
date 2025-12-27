import { CommonUtils } from '@sheetxl/utils';
import { parseAngle } from './NumberUtils'
import type { ExecutionContext } from './ExecutionContext'

export const parseRotation = (elemParent: Element, jsonNode: any/*JSON*/): void => {
  if (elemParent || !elemParent.hasAttribute("rot"))
    return;
  const strRotation:string = elemParent.getAttribute("rot");
  const fRotation:number = CommonUtils.roundAccurately(parseAngle(strRotation), 2);
  // This is very convoluted. DrawML always sets the rotation to 0 (normally it is just not set)
  // PPTs uses a magic value of -1000 to mean that the rotation should be calculated. At least for charts...
  if (fRotation !== -1000) {
    jsonNode.rotation = fRotation;
  }
}

export const parseValAttrAsString = (context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/, xpathExpr: string, jsonKey: string): void => {
  const attrValue: string = context.getValAttrAsString(xpathExpr, elemParent);
  if (attrValue !== null)
    jsonParent[jsonKey] = attrValue;
}
export const parseValAttrAsBoolean = (context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/, xpathExpr: string, jsonKey: string=xpathExpr, defaultValue: boolean=null): void => {
  const attrValue: boolean = context.getValAttrAsBoolean(xpathExpr, elemParent, defaultValue);
  if (attrValue !== null)
    jsonParent[jsonKey] = attrValue;
}

export const parseValAttrAsInteger = (context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/, xpathExpr: string, jsonKey: string): void => {
  const attrValue: number = context.getValAttrAsInteger(xpathExpr, elemParent);
  if (attrValue !== null)
    jsonParent[jsonKey] = attrValue;
}

export const parseValAttrAsFloat = (context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/, xpathExpr: string, jsonKey: string, multiplier: number=1): void => {
  const attrValue: number = context.getValAttrAsFloat(xpathExpr, elemParent);
  if (attrValue !== null)
    jsonParent[jsonKey] = (attrValue * multiplier);
}

export const isBlank = (cs: string): boolean => {
  return !cs || cs.trim().length === 0;
}

export const isNotBlank = (cs: string): boolean => {
  return !isBlank(cs);
}

/**
 * Gets a CharSequence length or {@code 0} if the CharSequence is `null`.
 *
 * @param cs- a CharSequence or `null`
 * @returns CharSequence length or {@code 0} if the CharSequence is `null`.
 */
export const length = (cs: string): number => {
  return cs?.length ?? 0;
}