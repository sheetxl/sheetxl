
import { IAutoFilter, type Scalar } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import { ExecutionContext } from '../ExecutionContext';

import * as NumberUtils from '../NumberUtils';

export class AutoFilterVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonParent: any): IAutoFilter.JSON {
    if (!elem) return;

    const jsonAutoFilter: IAutoFilter.JSON = {} as IAutoFilter.JSON;
    context.copyFromAttribute(elem, "ref", jsonAutoFilter);
    this.processFilterColumns(context, elem, jsonAutoFilter);

    if (Object.keys(jsonAutoFilter).length > 0) {
      jsonParent.filter = jsonAutoFilter;
    }
    return jsonAutoFilter;
  }

  processColorFilter(context: ExecutionContext, elem: Element): IAutoFilter.ColorCriterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Color
    } as IAutoFilter.ColorCriterian;
    context.copyFromAttribute(elem, "cellColor", jsonFilter, "cellColor", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "dxfId", jsonFilter, "styleId", context.INT_COPY);
    return jsonFilter;
  }

  processCustomFilter(context: ExecutionContext, elem: Element): IAutoFilter.CustomFilter {
    const jsonFilter = {} as IAutoFilter.CustomFilter;
    context.copyFromAttribute(elem, "operator", jsonFilter, "operator", context.BOOLEAN_COPY);
    // TODO - createCellUpdateFromString. We need the 1904 flag, if a ICell.Update is a single key (value)
    context.copyFromAttribute(elem, "val", jsonFilter, "val");
    return jsonFilter;
  }

  processCustomFilters(context: ExecutionContext, elem: Element): IAutoFilter.CustomCriterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Custom
    } as IAutoFilter.CustomCriterian;

    context.copyFromAttribute(elem, "and", jsonFilter, "and", context.BOOLEAN_COPY);

    const childNodes:NodeList = elem.childNodes;
    jsonFilter.filters = [];
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType !== 1) continue;
      let filter = null;
      if (elem.localName === 'customFilter') {
        filter = this.processCustomFilter(context, elem);
      }
      if (filter)
        jsonFilter.filters.push(filter);
    }
    return jsonFilter;
  }

  processDynamicFilter(context: ExecutionContext, elem: Element): IAutoFilter.DynamicCriterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Dynamic
    } as IAutoFilter.DynamicCriterian;

    context.copyFromAttribute(elem, "type", jsonFilter, "dynamicType",);
    context.copyFromAttribute(elem, "val", jsonFilter, "val", context.INT_COPY);
    context.copyFromAttribute(elem, "maxVal", jsonFilter, "maxVal", context.INT_COPY);
    return jsonFilter;
  }

  processDateGroupItem(context: ExecutionContext, elem: Element): IAutoFilter.DateGroupItem {
    const jsonFilter = {} as IAutoFilter.DateGroupItem;
    // TODO - try to parse this as a float?
    context.copyFromAttribute(elem, "dateTimeGrouping", jsonFilter, "group");
    context.copyFromAttribute(elem, "day", jsonFilter, "day", context.INT_COPY);
    context.copyFromAttribute(elem, "hour", jsonFilter, "hour", context.INT_COPY);
    context.copyFromAttribute(elem, "minute", jsonFilter, "minute", context.INT_COPY);
    context.copyFromAttribute(elem, "month", jsonFilter, "month", context.INT_COPY);
    context.copyFromAttribute(elem, "second", jsonFilter, "second", context.INT_COPY);
    context.copyFromAttribute(elem, "year", jsonFilter, "year", context.INT_COPY);
    return jsonFilter;
  }

  processFilterItem(context: ExecutionContext, elem: Element): Scalar {
    if (!elem.hasAttribute("val"))
    return;
    // TODO - createCellUpdateFromString. We need the 1904 flag, if a CellUpdate is a single key (value)
    return elem.getAttribute("val");
  }

  processFilters(context: ExecutionContext, elem: Element): IAutoFilter.FilterItemCriterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Items
    } as IAutoFilter.FilterItemCriterian;

    context.copyFromAttribute(elem, "blank", jsonFilter, "blank", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "calendarType", jsonFilter, "calendarType");

    let dateGroups:IAutoFilter.DateGroupItem[] = [];
    let items:Scalar[] = [];

    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType !== 1) continue;
      if (elem.localName === 'dateGroupItem') { // 1 - Node.ELEMENT_NODE;
        const dateGroupItem = this.processDateGroupItem(context, elem);
        if (dateGroupItem)
          dateGroups.push(dateGroupItem);
      } else if (elem.localName === 'filter') { // 1 - Node.ELEMENT_NODE;
        const item = this.processFilterItem(context, elem);
        if (item !== undefined) // we allow null.
          items.push(item);
      }
    }

    if (dateGroups.length > 0) {
      jsonFilter.dateGroups = dateGroups;
    }
    if (items.length > 0) {
      jsonFilter.items = items;
    }

    return jsonFilter;
  }

  processIcon(context: ExecutionContext, elem: Element): IAutoFilter.IconCriterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Icon
    } as IAutoFilter.IconCriterian;
    context.copyFromAttribute(elem, "iconId", jsonFilter, "iconId", context.INT_COPY);
    context.copyFromAttribute(elem, "iconSet", jsonFilter);
    return jsonFilter;
  }

  processTop10(context: ExecutionContext, elem: Element): IAutoFilter.Top10Criterian {
    const jsonFilter = {
      type: IAutoFilter.Type.Top10
    } as IAutoFilter.IconCriterian;
    context.copyFromAttribute(elem, "filterVal", jsonFilter, "filterVal", context.FLOAT_COPY);
    context.copyFromAttribute(elem, "percent", jsonFilter, "percent", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "top", jsonFilter, "top", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "val", jsonFilter, "val", context.FLOAT_COPY);
    return jsonFilter;
  }

  processFilterCriteria(context: ExecutionContext, elem: Element, jsonParent: IAutoFilter.IndexedField): IAutoFilter.Criterian[] {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    const criteria: IAutoFilter.Criterian[] = [];
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType !== 1) continue;
      let criterian = null;
      if (elem.localName === 'colorFilter') {
        criterian = this.processColorFilter(context, elem);
      } else if (elem.localName === 'customFilters') { // these are number filters
        criterian = this.processCustomFilters(context, elem);
      } else if (elem.localName === 'dynamicFilter') { // these are date filters
        criterian = this.processDynamicFilter(context, elem);
      } else if (elem.localName === 'filters') {
        criterian = this.processFilters(context, elem);
      } else if (elem.localName === 'iconFilter') {
        criterian = this.processIcon(context, elem);
      } else if (elem.localName === 'top10') {
        criterian = this.processTop10(context, elem);
      }
      if (criterian)
        criteria.push(criterian);
    }
    if (criteria.length > 0) { // should we also mark type
      jsonParent.criteria = criteria;
    }

    return criteria;
  }

  processFilterColumn(context: ExecutionContext, elem: Element): IAutoFilter.IndexedField {
    if (!elem)  return null;

    const jsonField:IAutoFilter.IndexedField = {} as IAutoFilter.IndexedField;

    if (!elem.hasAttribute("colId"))
      return;

    jsonField.offset = parseInt(elem.getAttribute("colId"));

    let hiddenButton = false;
    if (elem.hasAttribute("hiddenButton")) {
      hiddenButton = NumberUtils.parseAsBoolean(elem.getAttribute("hiddenButton"));
    }
    if (hiddenButton)
      jsonField.hiddenButton = true;

    if (elem.hasAttribute("showButton")) {
      jsonField.showButton = NumberUtils.parseAsBoolean(elem.getAttribute("showButton"));
    }

    this.processFilterCriteria(context, elem, jsonField);

    return jsonField;
  }

  processFilterColumns(context: ExecutionContext, elem: Element, jsonParent: IAutoFilter.JSON): IAutoFilter.IndexedField[] {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    const fields: IAutoFilter.IndexedField[] = [];
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType === 1 && elem.localName === 'filterColumn') { // 1 - Node.ELEMENT_NODE;
        const field = this.processFilterColumn(context, elem);
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
