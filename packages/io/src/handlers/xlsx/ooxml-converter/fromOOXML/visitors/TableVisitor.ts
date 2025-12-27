import type { ITable, ITableStyle } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class TableVisitor implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonTable: ITable.JSON): ITable.JSON {

    context.copyFromAttribute(elem, "name", jsonTable);
    context.copyFromAttribute(elem, "displayName", jsonTable);

    context.copyFromAttribute(elem, "ref", jsonTable);
    context.copyFromAttribute(elem, "headerRowCount", jsonTable, "headerRowCount", context.INT_COPY);
    context.copyFromAttribute(elem, "totalsRowCount", jsonTable, "totalsRowCount", context.INT_COPY);

    // totalsRowShown

    this.processTableColumns(context, elem, jsonTable);
    this.processTableStyleInfo(context, elem, jsonTable);

    // tables?: ResolvableProperties<Table>[];

    // comment
    // connectionId

    // tableType - worksheet, queryTable, xml

    // formatting fields
    /* If can't find any example of this working. The doc suggest this will override the body (table without rows/header) but with testing I couldn't get this to work. */
    // dataCellStyle?

    // tableBorderDxfId
    // dataDxfId?
    // headerRowCellStyle
    // headerRowBorderDxfId
    // headerRowDxfId
    // totalsRowBorderDxfId
    // totalsRowCellStyle
    // totalsRowDxfId

    // insertRow
    // insertRowShift

    return jsonTable;
  }

  processTableStyleInfo(context: ExecutionContext, elem: Element, jsonTable: ITable.JSON): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    const styleOptions: ITableStyle.StyleOptions = {};
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType === 1 && elem.localName === 'tableStyleInfo') { // 1 - Node.ELEMENT_NODE;
        context.copyFromAttribute(elem, "name", styleOptions);
        context.copyFromAttribute(elem, "showColumnStripes", styleOptions, "showColumnStripes", context.BOOLEAN_COPY);
        context.copyFromAttribute(elem, "showFirstColumn", styleOptions, "showFirstColumn", context.BOOLEAN_COPY);
        context.copyFromAttribute(elem, "showLastColumn", styleOptions, "showLastColumn", context.BOOLEAN_COPY);
        context.copyFromAttribute(elem, "showRowStripes", styleOptions, "showRowStripes", context.BOOLEAN_COPY);
      }
    }
    if (Object.keys(styleOptions).length > 0) {
      jsonTable.styleOptions = styleOptions;
    }
  }


  processTableColumn(context: ExecutionContext, elem: Element, columns: Partial<ITable.Column>[]): any/*JSON*/ {
    if (!elem)  return null;

    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType === 1 && elem.localName === 'tableColumn') { // 1 - Node.ELEMENT_NODE;
        const column:Partial<ITable.Column> = {};

        // id
        context.copyFromAttribute(elem, "name", column);
        context.copyFromAttribute(elem, "uniqueName", column);

        // process calculatedColumnFormula
        // process totalsRowFormula
        // xmlColumnPr

        // queryTableFieldId


        // totalsRowFunction
        // totalsRowLabel

        // dataCellStyle
        // dataDxfId
        // headerRowCellStyle
        // headerRowDxfId
        // totalsRowCellStyle
        // totalsRowDxfId
        columns.push(column);
      }
    }

    return columns;
  }

  processTableColumns(context: ExecutionContext, elem: Element, jsonParent: ITable.JSON): any/*JSON*/ {
    const childNodes:NodeList = elem.childNodes;
    const columns: ITable.Column[] = [];
    for (let i=0; i<childNodes.length; i++) {
      const elem:Element = childNodes.item(i) as Element;
      if (elem.nodeType === 1 && elem.localName === 'tableColumns') { // 1 - Node.ELEMENT_NODE;
        this.processTableColumn(context, elem, columns);
      }
    }
    if (columns.length > 0) {
      jsonParent.columns = columns;
    }
  }
}