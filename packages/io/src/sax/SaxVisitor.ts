import { SaxParser } from './SaxParser';


// Copied from DOM ExecutionContext
type ValueMutator = (value: any) => any;

const _BOOLEAN_COPY = (value: any): boolean => {
  if (value === true || value === "1" || value === "on" || value === "true") return true;
  if (value === false || value === "0" || value === "off" || value === "false") return false;
  return null;
}

const _INTEGER_COPY = (value: any): number => {
  const asInt = parseInt(value);
  if (isNaN(asInt)) return null;
  return asInt;
}

const _FLOAT_COPY = (value: any): number => {
  const asFloat = parseFloat(value);
  if (isNaN(asFloat)) return null;
  return asFloat;
}

export const CopyMutators = {
  Boolean: _BOOLEAN_COPY,
  Integer: _INTEGER_COPY,
  Float: _FLOAT_COPY,
  Default: null
} as const;

export interface SAXExecutionContext<J=any> {
  getSource: () => J;
  setSource: (value: J) => void;
  setKey: (key: string) => void;
  getFrom(): SaxParser.Tag;
  getAttribute<T=string>(name: string, mutator?: ValueMutator | ValueMutator[]): T;
  hasAttribute(name: string): boolean;
  getParent: <P=any>() => P;
  getPath: () => string;
  copyTo: (key: keyof J, mutator?: ValueMutator | ValueMutator[], from?: string) => void;
  copyToObject: <T>(object: Partial<T>, key: keyof T, mutator?: ValueMutator | ValueMutator[], from?: string) => void;
  parseAttribute: (from?: string, mutator?: ValueMutator | ValueMutator[]) => any | undefined;
  warn(message: string): void;
}


export interface SaxVisitor<J=any, P=any> {
  from: string,
  /**
   * `to` a key or an array.
   */
  to: (keyof P) | [] | {};
  openTag?(context: SAXExecutionContext<J>): void;
  closeTag?(context: SAXExecutionContext<J>): void;
  attribute?(attribute: string, value: string, context: SAXExecutionContext<J>): void;
  text?(text: string, context: SAXExecutionContext<J>): void;
  // error?
  comment?(comment: string, context: SAXExecutionContext<J>): void;
}

interface JSONDestination { key: string, source: any };
interface SaxNode {
  local: string;
  tag: SaxParser.Tag;
  visitor: SaxVisitor;
  destination: JSONDestination;
}
export class SaxVisitHandler {

  protected _registeredVisitors: Map<string, SaxVisitor> = new Map();

  registerVisitor<J=any, P=any>(visitor: SaxVisitor<J, P>): void {
    this._registeredVisitors.set(visitor.from, visitor);
  }


  createEventHandler(root: any, onEnd?: () => void, onWarning?: (message: string) => void): SaxParser.EventHandler {
    const registeredVisitors = this._registeredVisitors;
    const stackSaxNode:SaxNode[] = [];
    let currentNode:SaxNode = null;
    let currentTagName:string = null; // We could stop validating close tags for a performance boost (probably minor)
    let currentTag:SaxParser.Tag = null; // We could stop validating close tags for a performance boost (probably minor)
    let currentSaxVisitor:SaxVisitor = null;

    // skips nodes
    const destinations:JSONDestination[] = [];
    const rootDestination = { key: null, source: root };

    let currentDestination:JSONDestination = null;
    // if a visitor was registered with a null to we ignore all of the values.
    // TODO - when ignore collect the string to pass to close for manual dom parsing
    let ignoreTree = false;

    const parseAttribute = (from?: any, mutator?: ValueMutator | ValueMutator[]): any => {
      const attributes = currentTag.attributes;
      let attrName = from;
      let value = attributes[attrName as string];
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
      return value;
    }
    const context:SAXExecutionContext<any> = {
      getSource: (): any => {
        return currentDestination.source;
      },
      setSource: (source: any): void => {
        currentDestination.source = source;
      },
      setKey: (key: string): void => {
        currentDestination.key = key;
      },
      getFrom: (): SaxParser.Tag => {
        return currentTag;
      },
      getAttribute: <T>(name: string, mutator?: ValueMutator | ValueMutator[]): T => {
        return parseAttribute(name, mutator) ?? null;
      },
      hasAttribute: (name: string): boolean => {
        const attValue = context.getAttribute(name);
        return attValue !== null;
      },
      getParent: <P=any>(): P => {
        return destinations[destinations.length - 2].source as P;
      },
      getPath: () => {
        const nodes:string[] = []
        for (let i=0;i<stackSaxNode.length; i++) {
          nodes.push(stackSaxNode[i].local);
        }
        return nodes.join('\\');
      },
      parseAttribute,
      copyToObject: <T>(object: Partial<T>, to: keyof any, mutator?: ValueMutator | ValueMutator[], from?: string): void => {
        const value = parseAttribute(from ?? to, mutator);
        if (value === undefined) return;
        object[to] = value;
      },
      copyTo: (to: keyof any, mutator?: ValueMutator | ValueMutator[], from?: string): void => {
        const value = parseAttribute(from ?? to, mutator);
        if (value === undefined) return;
        currentDestination.source[to] = value;
      },
      warn: (message: string): void => {
        if (onWarning) {
          onWarning?.(message);
        } else {
          console.warn(message);
        }
      }
    }
    const onOpenTag = (tag: SaxParser.Tag) => {
      let local = tag.name;
      const colon = local.indexOf(":");
      if (colon !== -1) {
        local = local.slice(colon + 1);
      }
      const visitor = registeredVisitors.get(local);
      // TODO - allow visitor to register same local with different namespaces. We can it we need to
      currentNode = {
        local,
        visitor,
        tag,
        destination: null
      };
      if (ignoreTree) {
        stackSaxNode.push(currentNode);
        currentTagName = local;
        currentTag = tag;
        return;
      }
      currentSaxVisitor = currentNode?.visitor ?? null;
      if (visitor) {
        if (stackSaxNode.length === 0) {
          currentDestination = rootDestination;
        } else if (currentSaxVisitor?.to !== null) {
          currentDestination = { key: null, source: {} };
        } else {
          currentDestination = null;
        }
        currentNode.destination = currentDestination;
        if (currentDestination) {
          destinations.push(currentDestination);
        }
        // TODO - should we set value here or on close?
      }
      stackSaxNode.push(currentNode);

      currentTagName = local;
      currentTag = tag;
      ignoreTree = currentSaxVisitor?.to === null;
      // console.log(ignoreTree ? 'ignore' : 'open', local);
      currentSaxVisitor?.openTag?.(context);
    }

    const onCloseTag = (tag: SaxParser.Tag) => {
      let local = tag.name;
      const colon = local.indexOf(":");
      if (colon !== -1) {
        local = local.slice(colon + 1);
      }
      if (local !== currentTagName) {
        throw new Error(`mismatch open/close tag: '${local}'/'${currentTagName}'`);
      }

      if (!ignoreTree) {
        // console.log('close', local);
        currentSaxVisitor?.closeTag?.(context);
      }

      const closing:SaxNode = stackSaxNode.pop() ?? null;
      currentNode = stackSaxNode[stackSaxNode.length - 1] ?? null;
      const closeDestination = closing?.destination;

      if (closeDestination) { // also check keys length?
        destinations.pop();
        currentDestination = destinations[destinations.length - 1] ?? rootDestination;
        const visitor = closing.visitor;
        if (visitor && visitor.to && closeDestination.source !== undefined) {
          if (Array.isArray(visitor.to)) {
            // should not occur but if registration is incorrect
            // or we registered a tag that is showing up in the wrong place
            if (currentDestination.source.push) {
              currentDestination.source.push(closeDestination.source)
            } else {
              onWarning?.(`Unable to parse array for ${visitor.from} at ${context.getPath()}`);
            }
          } else if (closeDestination.key) {
            currentDestination.source[closeDestination.key] = closeDestination.source;
          } else if (typeof visitor.to === 'string') {
            currentDestination.source[visitor.to] = closeDestination.source;
          } else {
            // throw error
          }
        }
      }
      currentTagName = currentNode?.local ?? null; // could be param tag but this validates better
      currentTag = currentNode?.tag ?? null;  // could be param tag but this validates better
      currentSaxVisitor = currentNode?.visitor ?? null;
      ignoreTree = !currentNode?.destination;
    }

    // const onAttribute = (attribute: any) => {
    //   currentSaxVisitor?.attribute?.(attribute.name, attribute.value);
    // }

    const onText = (text: string) => {
      currentSaxVisitor?.text?.(text, context);
    }

    return {
      onOpenTag,
      onCloseTag,
      // onAttribute,
      onText,
      onEnd
    }
  }
}