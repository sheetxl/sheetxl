import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class LegendEntryVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {

    // SheetXL models legend entries as series titles
    // Office documents always put legendEntries after series so we know it will be here.

    // Note -
    // The more correct approach is to:
    // a. move all afterVisits to after graph is completely built.
    // b. access all series through the getFromPath(root).

    const jsonSeriesArray: any[] = context.getVisitorParamsState().get("series");

    let idx:number = context.getValAttrAsInteger("idx", elemParent);
    let jsonSeries: any/*JSON*/ = jsonSeriesArray[idx];
    if (jsonSeries) {
      let jsonTitle: any/*JSON*/ = context.getFromPath(jsonSeries, "title");
      if (!jsonTitle) {
        jsonTitle = {};
        context.setToPath(jsonSeries, "title", jsonTitle);
      }

      let legendEntry: any/*JSON*/ = jsonTitle;
      let deleted: boolean|null = context.getValAttrAsBoolean("delete", elemParent);
      if (deleted !== null) {
        legendEntry.shown = !deleted;
      }
      return legendEntry;
    }

    return jsonParent;
  }
}