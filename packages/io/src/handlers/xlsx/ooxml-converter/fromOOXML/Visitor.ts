import type { ExecutionContext } from './ExecutionContext';

export interface Visitor {

  /**
   * Parses the specified xmlElementContext and builds a corresponding json object node.
   * The json object node that is built is set into the root json object at the appropriate location.
   * For example, in case of ChartType Visitor, the json object is set into the "types" keys of the global json object.
   * The returned json object "node" is used for calling afterVisit for any post processing logic.
   *
   * @param context Contains the xmlElementContext's container element, root xml doc, json object container node, root json object
   * @param elemParent The xml element being parsed
   * @param jsonParent  Object converted from specified <code>xmlElementContext</code>
   */
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/;

  /**
   * Performs post processing logic on the jsonObjectContext.
   *
   * @param context Contains the xmlElementContext's container element, root xml doc, json object container node, root json object
   * @param elemParent The xml element being parsed
   * @param jsonParent The json object node returned by <code>visit</code method
   */
  afterVisit?(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/;
}