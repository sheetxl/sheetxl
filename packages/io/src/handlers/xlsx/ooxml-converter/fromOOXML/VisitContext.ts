export interface VisitContext {

  getXmlRootDoc(): Document;

  getXmlContainerElement(): Element;

  getJsonOutputRootObject(): any/*JSON*/;

  getJsonOutputContainerNode(): any/*JSON*/;

  getVisitorParamsState(): Map<string, any>;

  // If object === null then uses current jsonContainerKey
  getFromPath(path: string, obj: any/*Object*/): any/*JSON*/;

  // If object === null then uses current jsonContainerKey
  setToPath(path: string, value: any/*Object*/, obj: any/*JSON*/): void;

  // evaluate(xpathExpr: string, contextNode: Element);
}
