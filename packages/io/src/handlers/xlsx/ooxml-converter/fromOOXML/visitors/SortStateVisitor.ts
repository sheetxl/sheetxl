import { IAutoSort, ISort, Sort, IRange, AddressUtils } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import * as NumberUtils from '../NumberUtils';

export class SortStateVisitor implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonParent: any): IAutoSort.JSON {
    if (!elem) return;

    const jsonSortState: IAutoSort.JSON = {} as IAutoSort.JSON;
    // TODO - how to localize this? (perhaps do this in after of the parent?)
    context.copyFromAttribute(elem, "ref", jsonSortState);

    if (elem.hasAttribute("caseSensitive")) {
      const caseSensitive:boolean = NumberUtils.parseAsBoolean(elem.getAttribute("caseSensitive"));
      jsonSortState.collatorOptions = caseSensitive ? Sort.CaseSensitiveOptions : Sort.CaseInsensitiveOptions;
    }

    const sortMethod = elem.getAttribute("sortMethod");
    if (sortMethod != null && sortMethod !== 'none') {
      // TODO - set Locale to zh
      if (sortMethod === 'stroke') { // different casing
        jsonSortState.collatorOptions = {
          ...jsonSortState.collatorOptions,
          collation: 'stroke'
        }
      } else if (sortMethod === 'pinYin') {
        jsonSortState.collatorOptions = {
          ...jsonSortState.collatorOptions,
          collation: 'pinyin' // different casing
        }
      }
    }

    if (elem.hasAttribute("columnSort")) {
      const columnSort:boolean = NumberUtils.parseAsBoolean(elem.getAttribute("columnSort"));
      if (columnSort) {
        // TODO - This is not correct as we sort the orientation on the Range not the field. Review
        (jsonSortState as any).orientation = IRange.Orientation.Column;
      }
    }

    const ref:IRange.Coords = AddressUtils.fastStringToRange(jsonSortState.ref);

    this.processSortConditions(context, elem, jsonSortState, ref);

    if (Object.keys(jsonSortState).length > 0) {
      jsonParent.sort = jsonSortState;
    }

    return jsonSortState;
  }

  processSortCondition(context: ExecutionContext, elem: Element, refRange: IRange.Coords): ISort.Field {
    if (!elem)  return null;

    const field:ISort.Field = {} as ISort.Field;

    if (!elem.hasAttribute("ref")) {
      console.warn('no ref for sort conditional', context.getPath());
      return;
    }
    if (elem.hasAttribute("ref")) {
      const refString = elem.getAttribute("ref");
      const ref:IRange.Coords = AddressUtils.fastStringToRange(refString);
      field.offset = refRange ? (ref.colStart - refRange.colStart) : ref.colStart;
    }

    field.reverse = false;
    if (elem.hasAttribute("descending")) {
      field.reverse = NumberUtils.parseAsBoolean(elem.getAttribute("descending"));
    }

    context.copyFromAttribute(elem, "sortBy", field, "sortOn");

    /* when sortby == cellColor or fontColor */
    // TODO - this is a style offset id. pass the mappings
    context.copyFromAttribute(elem, "dxfId", field);
    /* when sortBy == icon */
    context.copyFromAttribute(elem, "iconSet", field);

    context.copyFromAttribute(elem, "customList", field);

    return field;
  }

  processSortConditions(context: ExecutionContext, elem: Element, jsonParent: IAutoSort.JSON, refRange: IRange.Coords): ISort.Field[] {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    const fields:ISort.Field[] = [];
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType === 1 && elem.localName === 'sortCondition') { // 1 - Node.ELEMENT_NODE;
        const field = this.processSortCondition(context, elem, refRange);
        if (field)
          fields.push(field);
      }
    }
    if (fields.length > 0) {
      jsonParent.fields = fields;
    }

    return fields;
  }
}
