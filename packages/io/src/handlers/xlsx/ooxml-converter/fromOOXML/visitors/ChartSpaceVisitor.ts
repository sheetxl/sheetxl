import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class ChartSpaceVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    //TODO: parse c:date1904
    //TODO: parse c:lang

    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonParent, "roundedCorners", "roundedCorners");
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonParent, ".//AlternateContent/Fallback/style", "styleId");

    // This is not available from office so we mark it as null as a clue for sheetxl
    jsonParent.range = null;

    //ctx.setValueFromBooleanAttribute()
    /**

     ctx.copy(new ValAttributeGetter("roundedCorners"), new BooleanSetter());

     Getter
     getXMLValue(ctx, setter)

     Setter
     setJsonValue(ctx, path, value);

     copyIfPresent(ctx, path, setter) {
     const elem: Element = ctx.evaluate(path) as Element;
     if (elem)
       setter.setValue(elem)
     }

     ctx.copy(new ValAttributeGetter(new SimpleSetter("roundedCorners"),

     copyValue(getter, setter) {
       copyIfPresent(new Converter(), new Setter());
    }
    */

    return jsonParent;
  }

  afterVisit(context: ExecutionContext, chartSpaceElement: Element, jsonChartSpace: any/*JSON*/): void {
    //connect chart types to axes
    // Note - This algo assumes there is always at least one type and will
    //        discard axes that are in the xml but not referenced. (but valid from xml but not from office)

    let jsonTypes: any/*JSON*/ = {};
    jsonChartSpace.types = jsonTypes;

    let jsonXAxes: any/*JSON*/ = {};
    let xAxesLength: number = 0;

    let jsonYAxes: any/*JSON*/ = {};
    let yAxesLength: number = 0;

    let axes: Map<string, any> = context.getVisitorParamsState().get("axes");
    const chartTypes: any[] = context.getVisitorParamsState().get("types");

    for (let i=0; i<chartTypes.length; i++) {
      const jsonChartType: any/*JSON*/ = chartTypes[i];
      //TODO: how about 3D charts?
      if (jsonChartType.xAxisId) {
        const xAxisId: string = jsonChartType.xAxisId;
        const xAxes: any/*JSON*/ = axes.get(xAxisId);
        jsonXAxes[i+""] = xAxes;
        jsonChartType.offsetXAxis = i;
        delete jsonChartType.xAxisId;

        jsonChartSpace.xAxes = jsonXAxes;
        jsonXAxes.length = ++xAxesLength;
      }
      if (jsonChartType.yAxisId) {
        const yAxisId: string = jsonChartType.yAxisId;
        const yAxes: any/*JSON*/ = axes.get(yAxisId);
        jsonYAxes[i+""] = yAxes;
        jsonChartType.offsetYAxis = i;
        delete jsonChartType.yAxisId;

        jsonChartSpace.yAxes = jsonYAxes;
        jsonYAxes.length = ++yAxesLength;
      }
      jsonTypes[i+""] = jsonChartType;
    }
    jsonTypes.length = chartTypes.length;

    const jsonSeriesArray: any[] = context.getVisitorParamsState().get("series");
    if (!jsonSeriesArray || jsonSeriesArray.length === 0)
      return;

    // convert series array to a object
    const jsonSeriesObject: any/*JSON*/ = {};
    jsonChartSpace.series = jsonSeriesObject;
    for (let i=0; i<jsonSeriesArray.length; i++) {
      jsonSeriesObject[i+""] = jsonSeriesArray[i];
    }
    jsonSeriesObject.length = jsonSeriesArray.length;
  }
}