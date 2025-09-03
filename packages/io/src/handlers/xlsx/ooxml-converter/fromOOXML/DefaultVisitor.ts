import type { Visitor } from './Visitor';
import type { ExecutionContext } from './ExecutionContext';

export class DefaultVisitor implements Visitor {
  private jsonKey: string;

  constructor(jsonKey: string) {
    this.jsonKey = jsonKey;
  }

  visit(_context: ExecutionContext, _elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonObject = {};
    jsonParent[this.jsonKey] = jsonObject;
    return jsonObject;
  }
}