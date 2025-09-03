import { CommonUtils } from '@sheetxl/utils';

import type { RelationShipType, ConvertFromOptions } from '../OOXMLTypes';

class WrappedElementNodeList implements NodeList {
  private list: Element[];

  constructor(list: Element[]) {
    this.list = list;
  }

  get length(): number {
    return this.list.length;
  }

  item(index: number): Element {
    return this.list[index];
  }

  // TODO - bind to the correct this
  forEach(callback: (value: Node, key: number, parent: NodeList) => void, _thisArg?: any): void {
    for (let i=0; i<this.list.length; i++) {
      callback(this.list[i], i, this);
    }
  }

  [index: number]: Element; // TODO: Is this correct?
}

export interface VisitorParamsContainer {
  getVisitorParamsState(): Map<string, any>;
}

const _BOOLEAN_COPY = (value: any): boolean => {
  if (value === true || value === "1" || value === "on" || value === "true") return true;
  if (value === false || value === "0" || value === "off" || value === "false") return false;
  return null;
}

const _INT_COPY = (value: any): number => {
  const asInt = parseInt(value);
  if (isNaN(asInt)) return null;
  return asInt;
}

const _FLOAT_COPY = (value: any): number => {
  const asFloat = parseFloat(value);
  if (isNaN(asFloat)) return null;
  return asFloat;
}

const _EmptyMap = new Map<any, any>();

type ValueMutator = (value: any) => any;

/**
 * Used by visitors for context lookup.
 *
 * These are stackable and have a reference to their parent context.
 *
 */
export class ExecutionContext {

  private _getRef: (relId: string, location: string, asBinary: boolean) => any ;
  private _getRefs: (location: string) => Map<string, RelationShipType>;
  private _fileLocation: string;

  private jsonRoot: any/*JSON*/;
  private elemRoot: Element;

  private currentPath: string;
  private sharedShared: VisitorParamsContainer;

  protected _parent: ExecutionContext;
  private _onWarning: (message: string) => void;
  private _addPerson: (person: any) => string;

  constructor(
    parent: ExecutionContext,
    sharedState: VisitorParamsContainer,
    currentPath: string,
    elemRoot: Element,
    jsonRoot: any/*JSON*/,
    fileLocation: string=null,
    options: ConvertFromOptions
  ) {
    const getRef = (relId: string, location: string, asBinary: boolean): { location: string, data: any } => {
      return options?.getRef?.(relId, location, asBinary, options?.parsedRefs);
    }

    const getRefs = (location: string): any => {
      return options?.getRefs?.(location, options?.parsedRefs);
    }

    this._parent = parent;
    this.sharedShared = sharedState;
    this.currentPath = currentPath;
    this.elemRoot = elemRoot;
    this.jsonRoot = jsonRoot;
    if (parent) {
      this._fileLocation = parent._fileLocation;
      this._getRef = parent._getRef;
      this._getRefs = parent._getRefs;
    } else {
      if (fileLocation) {
        this._fileLocation = fileLocation;
      }
      if (getRef && getRefs) {
        this._getRef = getRef;
      }
      if (getRefs) {
        this._getRefs = getRefs;
      }
      this._onWarning = options?.onWarning;
      this._addPerson = options?.addPerson;
    }
  }

  getRef(relId: string, asBinary: boolean=false): any {
    return this._getRef?.(relId, this._fileLocation, asBinary) ?? null;
  }

  getRelationships(): Map<string, RelationShipType> {
    return this._getRefs(this._fileLocation) ?? _EmptyMap;
  }

  getPath(): string {
    return this.currentPath;
  }

  getElemRoot(): Element {
    return this.elemRoot;
  }

  getJsonRoot(): any/*JSON*/ {
    return this.jsonRoot;
  }

  warn(message: string): void {
    if (this._onWarning) {
      this._onWarning(message);
    } else if (this._parent) {
      this._parent?.warn?.(message);
    } else {
      console.warn(message);
    }
  }

  addPerson(person: any): string {
    if (this._addPerson) {
      return this._addPerson(person);
    } else if (this._parent) {
      return this._parent?._addPerson?.(person);
    } else {
      return null;
    }
  }

  getVisitorParamsState(): Map<string, any> {
    return this.sharedShared.getVisitorParamsState();
  }

  /**
   * This supports a very simple path find that includes wildcards.
   */
  // How to clean up having to always do an instance check
  // and have a bunch of for loops everywhere. Perhaps
  // pass a callback that acts like a filter (element, index)
  evaluate(path: string, element: Element): Element | NodeList {
    if (!path) {
      return element;
    }
    let currentElements: Element[] = [element];

    // strip the segments
    const s: string[] = path.split("/");

    for (let i=0; i<s.length; i++) {
      const seg = s[i];
      if (seg === "" || seg === ".")
        continue;
      let nextElements: Element[] = [];
      for (let j=0; j<currentElements.length; j++) {
        const currentElement = currentElements[j];
        const childNodes = currentElement.childNodes;
        for (let k=0; childNodes && k<childNodes.length; k++) {
          const child = currentElement.childNodes[k];
          const localName = (child as Element).localName;
          if (localName === seg || seg === "*") {
            nextElements.push(child as Element);
          }
        }
      }
      currentElements = nextElements;
    }

    if (currentElements.length === 1)
      return currentElements[0];
    else if (currentElements.length === 0)
      return null;
    return new WrappedElementNodeList(currentElements);
  }

  getFromPath(obj: any/*JSON*/, path: string): any/*JSON*/ {
    return CommonUtils.getFromPath(obj, path);
  }

  setToPath(obj: any/*JSON*/, path: string, value: any/*Object*/): any/*JSON*/ {
    return CommonUtils.setToPath(obj, path, value);
  }

  getValAttrAsString(xpathExpr: string, elemParent: Element): string|null {
    let xmlElement: Element = this.evaluate(xpathExpr, elemParent) as Element;
      if (!xmlElement || !xmlElement.hasAttribute("val"))
        return null;
      return xmlElement.getAttribute("val") ?? null;
  }

  getValAttrAsBoolean(xpathExpr: string, elemParent: Element, defaultValue:boolean=false): boolean|null {
    let xmlElement: Element = this.evaluate(xpathExpr, elemParent) as Element;
    if (!xmlElement)
      return null;
    const attribValue = xmlElement.hasAttribute("val") ? xmlElement.getAttribute("val") : undefined;
    if (attribValue === undefined || attribValue === null) return defaultValue;
    if (attribValue === "1" || attribValue === "on" || attribValue === "true") return true;
    if (attribValue === "0" || attribValue === "off" || attribValue === "false") return false;
    return defaultValue;
  }

  getValAttrAsInteger(xpathExpr: string, elemParent: Element): number|null {
    let xmlElement: Element = this.evaluate(xpathExpr, elemParent) as Element;
    if (!xmlElement || !xmlElement.hasAttribute("val"))
      return null;
    return parseInt(xmlElement.getAttribute("val")) ?? null;
  }

  getValAttrAsFloat(xpathExpr: string, elemParent: Element): number|null {
    let xmlElement: Element = this.evaluate(xpathExpr, elemParent) as Element;
    if (!xmlElement || !xmlElement.hasAttribute("val"))
      return null;

    return parseFloat(xmlElement.getAttribute("val")) ?? null;
  }

  get BOOLEAN_COPY() {
    return _BOOLEAN_COPY;
  }

  get INT_COPY() {
    return _INT_COPY;
  }

  get FLOAT_COPY() {
    return _FLOAT_COPY;
  }

  /**
   * Copies a value to the jsonParent if the attribute exists.
   */
  copyFromAttribute(elem: Element, attrName: string, jsonParent: any/*JSON*/, jsonPath: string=attrName, mutator: ValueMutator | ValueMutator[] = null): void {
    if (!elem || !jsonParent || !elem.hasAttribute(attrName)) return;
    const attrValue = elem.getAttribute(attrName);

    let value = attrValue;
    if (mutator) {
      if (Array.isArray(mutator)) {
        for (let i=0; i< mutator.length; i++) {
          if (value === null || value === undefined) return;
          value = mutator[i](value);
          if (value === null || value === undefined) return;
        }
      } else {
        // We are going to make this an array of mutators
        if (value === null || value === undefined) return;
        value = mutator(value);
        if (value === null || value === undefined) return;
      }
    }

    this.setToPath(jsonParent, jsonPath, value);
  }

}