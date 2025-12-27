import { DOMImplementation, XMLSerializer,
  Document as PartialDocument,
  Element as PartialElement
} from '@xmldom/xmldom';

import xmlFormatter from 'xml-formatter';

import * as OOXMLMappings from './toOOXML/OOXMLMappings';
import * as OOXMLUtils from './toOOXML/OOXMLUtils';

//default copy check
const defaultCopyCheck = function(property: any): boolean {
  return property !== undefined && property.isExplicit && property.value !== undefined;
}

//always copy check
const alwaysCopyCheck = function(property: any): boolean {
  return property !== undefined && property.value !== undefined;
}

export function getNativeClass(obj: any): string {
  if (obj === undefined) return "undefined";
  if (obj === null) return "null";
  return Object.prototype.toString.call(obj).match(/^\[object\s(.*)\]$/)[1];
}

export function getAnyClass(obj: any): string {
  if (obj === undefined) return "undefined";
  if (obj === null) return "null";
  return obj.className;
}

export interface ToOOXMLContext {

}

//initialize the execution context
export default class ToOOXMLConverter {
  visitHandlerRegistry: Record<string, any>;

  rootModelObj: any = null;
  rootXmlDoc: PartialDocument = null;
  visitedModels: any[] = [];
  nodePath: PartialElement[] = [];
  axisIds: Map<number, any>;
  c16UniqueIdCounter: number = 0;

  constructor() {
    this.visitHandlerRegistry = {
      'ChartShape' :  getVisitorInterface(chartShapeVisitor),
      'ChartTitleShape': getVisitorInterface(titleVisitor),
      'ChartAxisTitleShape': getVisitorInterface(titleVisitor),
      'ChartLegendShape' : getVisitorInterface(chartLegendVisitor),
      'ChartSeriesTitleTextShape' : getVisitorInterface(txPrVisitor),
      'ChartTextShape' : getVisitorInterface(txPrVisitor),
      'ManualLayout' : getVisitorInterface(manualLayoutVisitor),
      'ChartType' : getVisitorInterface(chartTypeVisitor),
      'ChartSeriesShape' : getVisitorInterface(chartSeriesVisitor),
      'ChartPieSeriesShape' : getVisitorInterface(chartSeriesVisitor),
      'ChartScatterSeriesShape' : getVisitorInterface(chartSeriesVisitor),
      'ChartTypeDataLabelShape' : getVisitorInterface(dataLabelShapeVisitor),
      'ChartSeriesDataLabelShape' : getVisitorInterface(dataLabelShapeVisitor),
      "ChartSeriesMarkerShape" : getVisitorInterface(chartSeriesMarkerShapeVisitor),
      'ChartValAxisShape' : getVisitorInterface(chartAxisVisitor),
      'ChartOrdAxisShape' : getVisitorInterface(chartAxisVisitor),
      'ChartDateAxisShape' : getVisitorInterface(chartAxisVisitor)
    }
    this.rootModelObj = null;
    this.rootXmlDoc = null;
    this.visitedModels = [];
    this.nodePath = [];
    this.axisIds = new Map();
    this.c16UniqueIdCounter = 0;
  }

  setAttribute(xmlNode: PartialElement, attrName: string, attrValue: any): void {
    //TODO: what is the rule if attrValue === null
    if (attrValue !== undefined)
      xmlNode.setAttribute(attrName, attrValue);
  }

  createNode(xmlNodeName: string): PartialElement {
    return this.rootXmlDoc.createElement(xmlNodeName);
  }

  createChildNodes(xmlNode: PartialElement, xpath: string): PartialElement {
    let paths = xpath.split('/')
    for (let i = 0; i < paths.length; i++) {
      let path = paths[i];
      let xmlChildNode = this.getNode(xmlNode, path);
      if (xmlChildNode === undefined) {
        //create it
        xmlChildNode = this.createChildNode(xmlNode, path);
        xmlNode = xmlChildNode
      } else {
        xmlNode = xmlChildNode
      }
    }
    return xmlNode;
  }

  createTextNode(text: string): PartialElement {
    return this.rootXmlDoc.createTextNode(text) as unknown as PartialElement;
  }

  createChildNode(xmlNode: PartialElement, childNodeName: string): PartialElement {
    let childNode = this.createNode(childNodeName);
    this.appendChildNode(xmlNode, childNode);
    return childNode;
  };

  appendChildNode(xmlParentNode: PartialElement, xmlChildNode: PartialElement, condition=true): void {
    if (condition) {
      xmlParentNode.appendChild(xmlChildNode);
    }
  }

  appendNonEmptyChildNode(xmlParentNode: PartialElement, xmlChildNode: PartialElement): void {
    this.appendChildNode(xmlParentNode, xmlChildNode, xmlChildNode.hasChildNodes() || xmlChildNode.hasAttributes());
  }

  copyValue(modelObj: any, modelPropertyPath: string, xmlNode: PartialElement, xmlChildNodeName: string, setterFunction: any, copyCheck:(prop: any) => boolean=defaultCopyCheck) {
    let propertyPath = modelPropertyPath.split(".");
    let property = modelObj.getPropertyValue(propertyPath);
    // if (!property) {
      // debugger;
      // console.warn('Unable to find property:' + modelObj.className + ':' + modelPropertyPath);
      // return;
    // }
    if (property && copyCheck(property)) {
      setterFunction(this, xmlNode, xmlChildNodeName, property.value);
    }
  }

  getNode(xmlNode: PartialElement, xpath: string): PartialElement {
    if (!xmlNode.getElementsByTagName) {
      debugger;
    }
    let paths = xpath.split('/')
    let xmlNodeCurrent = xmlNode;
    for (let i = 0; i < paths.length; i++) {
      let tagCurrent = paths[i];
      let nodeChildren = xmlNodeCurrent.childNodes;
      let nodeFound = null;
      for (let i = 0; !nodeFound && i<nodeChildren.length; i++) {
        if (nodeChildren[i].localName === tagCurrent || nodeChildren[i].nodeName === tagCurrent) {
          nodeFound = nodeChildren[i];
        }
      }
      if (!nodeFound)
        return;

      xmlNodeCurrent = nodeFound;
    }
    return xmlNodeCurrent;
  }

  visit(xmlNode: PartialElement, modelChildObj: any, xmlChildNodeName: string, visitorOverride?: any): PartialElement {
    let visitor = visitorOverride ? visitorOverride : this.visitHandlerRegistry[getAnyClass(modelChildObj)]
    if (visitor) {
      this.visitedModels.push(modelChildObj);
      this.nodePath.push(xmlNode);
      if (xmlChildNodeName) {
        let xmlChildNode = this.createNode(xmlChildNodeName);
        visitor.visit(this, modelChildObj, xmlChildNode);
        if (xmlChildNode.hasChildNodes() || xmlChildNode.hasAttributes()) {
          this.appendChildNode(xmlNode, xmlChildNode);
        }
        this.visitedModels.pop();
        this.nodePath.pop();
        return xmlChildNode;
      } else {
        visitor.visit(this, modelChildObj, xmlNode);
        this.visitedModels.pop();
        this.nodePath.pop();
        return xmlNode;
      }
    } else {
      console.warn('no visitor for ', xmlChildNodeName);
    }

    return null;
  }

  getParentNode() {
    return this.nodePath[this.nodePath.length-1];
  }

  getParentModel() {
    let length = this.visitedModels.length;
    if (length === 1) {
      return this.visitedModels[0];
    } else {
      return this.visitedModels[length - 2];
    }
  }

  convert(chartShape: any, options: any = {}) {
    let xmlDoc = new DOMImplementation().createDocument(null, '?xml', null);
    let rootElement = xmlDoc.createElement("c:chartSpace");
    xmlDoc.documentElement.appendChild(rootElement);

    rootElement.setAttribute('xmlns:c', 'http://schemas.openxmlformats.org/drawingml/2006/chart');
    rootElement.setAttribute('xmlns:a', 'http://schemas.openxmlformats.org/drawingml/2006/main');
    rootElement.setAttribute('xmlns:r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');
    rootElement.setAttribute('xmlns:c16r2', 'http://schemas.microsoft.com/office/drawing/2015/06/chart');

    this.rootModelObj = chartShape;
    this.rootXmlDoc = xmlDoc;
    this.visitedModels = [];
    this.visit(rootElement, chartShape, null/*childXmlNodeName*/);

    let retValue = new XMLSerializer().serializeToString(xmlDoc);
    // Note - We remove the xml tag and optional add back a tag that fits standalone style
    retValue = retValue.replace('<?xml>', '');
    retValue = retValue.replace('</?xml>', '');
    if (options.header === undefined || options.header === true) {
      retValue = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" + retValue;
    }

    // cleanup
    this.rootModelObj = null;
    this.rootXmlDoc = null;
    this.visitedModels = [];

    if (options?.prettify) {
      let prettyOpts = {
        indentation: '  ',
        collapseContent: true, // don't indent text fields as this would add white space to text
        filter: (_node) => {
            // if (node.type === 'Comment') {
            //     return false;
            // }
            return true;
        },
        // lineSeparator: '\n'
      }
      if (typeof options.prettify === 'object' && !Array.isArray(options.prettify)) {
        Object.assign(prettyOpts, options.prettify);
      }

      if (options?.debug) {
        console.log(retValue);
      }
      retValue = xmlFormatter(retValue, prettyOpts);
    }
    return retValue;
  }
} // end class

export type ToHandler<T=any> = (
  context: any,
  json: T,
  element: PartialElement
) => void;


function getVisitorInterface<T=any>(visitHandler: ToHandler<T>, afterVisitHandler?: ToHandler<T>) {
  return {
    visit : visitHandler,
    afterVisit : afterVisitHandler
  }
}

function chartShapeVisitor(context: ToOOXMLConverter, objChartSpace: any, xmlChartSpaceNode: PartialElement): any {
  let date1904Node = context.createChildNode(xmlChartSpaceNode, "c:date1904");
  context.setAttribute(date1904Node, "val", "0");
  let langNode = context.createChildNode(xmlChartSpaceNode, "c:lang");
  context.setAttribute(langNode, "val", "en-US");
  //rounded corners
  context.copyValue(objChartSpace, "roundedCorners", xmlChartSpaceNode, "c:roundedCorners", setChildValAttrAsBoolean, alwaysCopyCheck);
  //alternate content
  let xmlAlternateContent = context.createChildNode(xmlChartSpaceNode, "mc:AlternateContent");
  context.setAttribute(xmlAlternateContent, 'xmlns:mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006');
  //choice
  let xmlChoiceNode = context.createChildNode(xmlAlternateContent, "mc:Choice");
  context.setAttribute(xmlChoiceNode, "Requires", "c14");
  context.setAttribute(xmlChoiceNode, "xmlns:c14", "http://schemas.microsoft.com/office/drawing/2007/8/2/chart");
  context.copyValue(objChartSpace, "styleId", xmlChoiceNode, "c14:style", function(context, xmlNode, xpath, attrValue) {
    let styleValue = Number(attrValue) + 100;
    setChildValAttribute(context, xmlNode, xpath, styleValue);
  }, alwaysCopyCheck);
  //fallback
  let xmlFallback = context.createChildNode(xmlAlternateContent, "mc:Fallback");
  context.copyValue(objChartSpace, "styleId", xmlFallback, "c:style", setChildValAttribute, alwaysCopyCheck);
  //chart node
  let xmlChartNode = context.createChildNode(xmlChartSpaceNode, "c:chart");
  //title
  let chartTitle = objChartSpace.title;
  if (chartTitle && chartTitle.shown === true)
      context.visit(xmlChartNode, chartTitle, "c:title");
  //autoTitleDeleted
  context.copyValue(objChartSpace, "title.shown", xmlChartNode, "c:autoTitleDeleted", function(context, xmlNode, xpath, attrValue) {
    if (attrValue === undefined)//autoTitleDeleted is set to 0 if undefined in the model
      setChildValAttrAsBooleanFlip(context, xmlNode, xpath, "1");
    else
      setChildValAttrAsBooleanFlip(context, xmlNode, xpath, attrValue);
  }, alwaysCopyCheck);
  //plot area
  const xmlPlotAreaNode = context.createChildNode(xmlChartNode, "c:plotArea");
  //TODO: this is hardcoded for now
  let _layoutNode = context.createChildNode(xmlPlotAreaNode, "c:layout");
  //plot area chart types
  let xmlChartTypeNode =  null;
  if (objChartSpace.types) {
    let arraylength = objChartSpace.types.length;
    for (let i = 0; i < arraylength; i++) {
      let objChartType = objChartSpace.types.getAt(i);
      xmlChartTypeNode = processChartType(context, objChartSpace, objChartType, xmlPlotAreaNode);//, alwaysCopyCheck);
    }
  }

  // generate and set axis ids
  if (objChartSpace.xAxes) {
    setAxisIds(context, xmlChartTypeNode, objChartSpace.xAxes);
  }
  if (objChartSpace.yAxes) {
    setAxisIds(context, xmlChartTypeNode, objChartSpace.yAxes);
  }
  // TODO: plot area chart xAxes - use "offsetXAxis", "offsetYAxis" in chart type
  if (objChartSpace.xAxes) {
    visitAxes(context, objChartSpace.xAxes, xmlPlotAreaNode);
  }
  // plot area chart yAxes
  if (objChartSpace.yAxes) {
    visitAxes(context, objChartSpace.yAxes, xmlPlotAreaNode);//, xmlChartTypeNode);
  }

  // plotArea sh pr
  processShapeProperties(context, objChartSpace.plotArea, xmlPlotAreaNode, alwaysCopyCheck);

  // chartLegend
  let chartLegend = objChartSpace.legend;
  if (chartLegend && chartLegend.shown === true)
    context.visit(xmlChartNode, chartLegend, "c:legend");

  context.copyValue(objChartSpace, "plotVisOnly", xmlChartNode, "c:plotVisOnly", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(objChartSpace, "dispBlanksAs", xmlChartNode, "c:dispBlanksAs", setChildValAttribute, alwaysCopyCheck);

  let extLstNode = context.createChildNode(xmlChartNode, "c:extLst");
  let extNode = context.createChildNode(extLstNode, "c:ext");
  context.setAttribute(extNode, "uri", "{56B9EC1D-385E-4148-901F-78D8002777C0}");
  context.setAttribute(extNode, "xmlns:c16r3", "http://schemas.microsoft.com/office/drawing/2017/03/chart");
  context.copyValue(objChartSpace, "dispNaAsBlank", extNode, "c16r3:dataDisplayOptions16/c16r3:dispNaAsBlank", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.appendChildNode(xmlChartNode, extLstNode);

  context.copyValue(objChartSpace, "showDLblsOverMax", xmlChartNode, "c:showDLblsOverMax", setChildValAttrAsBoolean, alwaysCopyCheck);

  //chart shape sh pr
  processShapeProperties(context, objChartSpace, xmlChartSpaceNode, alwaysCopyCheck);

  //print settings
  let printSettingsNode = context.createChildNode(xmlChartSpaceNode, "c:printSettings");
  let _headerFooterNode = context.createChildNode(printSettingsNode, "c:headerFooter");
  let pageMarginsNode = context.createChildNode(printSettingsNode, "c:pageMargins");
  context.setAttribute(pageMarginsNode, "b", "0.75");
  context.setAttribute(pageMarginsNode, "l", "0.7");
  context.setAttribute(pageMarginsNode, "r", "0.7");
  context.setAttribute(pageMarginsNode, "t", "0.75");
  context.setAttribute(pageMarginsNode, "header", "0.3");
  context.setAttribute(pageMarginsNode, "footer", "0.3");
  let _pageSetupNode = context.createChildNode(printSettingsNode, "c:pageSetup");
}

function setAxisIds(context, xmlChartNode, axes) {
  let arraylength = axes.length;
  for (let i = 0; i < arraylength; i++) {
    let objChartAxis = axes.getAt(i);
    let axisId = OOXMLUtils.getAxisID();
    context.axisIds.set(objChartAxis, axisId);
    let axisIdChartNode = context.createChildNode(xmlChartNode, "c:axId");
    context.setAttribute(axisIdChartNode, "val", axisId);
  }
}

function visitAxes(context: ToOOXMLConverter, axes, xmlPlotAreaNode: PartialElement): void {
  let arraylength = axes.length
  for (let i = 0; i < arraylength; i++) {
    let axisType = getAnyClass(axes.getAt(i));
    let axisNodeName = null;
    if (axisType === "ChartValAxisShape") {
      axisNodeName = "c:valAx";
    } else if (axisType === "ChartOrdAxisShape") {
      axisNodeName = "c:catAx";
    } else if (axisType === "ChartDateAxisShape") {
      axisNodeName = "c:dateAx";
    }
    context.visit(xmlPlotAreaNode, axes.getAt(i), axisNodeName);
  }
}

function chartTypeVisitor(context: ToOOXMLConverter, objChartType: any, xmlChartTypeNode: PartialElement): void {
  if (objChartType.type === "bar" || objChartType.type === "column")
    context.copyValue(objChartType, "type", xmlChartTypeNode, "c:barDir",
      function(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any) {
        let barDir = attrValue === "column" ? "col" : attrValue;
        setChildValAttribute(context, xmlNode, xpath, barDir);
      },
    alwaysCopyCheck);

  if (objChartType.type === "bar" || objChartType.type === "column" || objChartType.type === "line")
    context.copyValue(objChartType, "grouping", xmlChartTypeNode, "c:grouping", setChildValAttribute, alwaysCopyCheck);

  if (objChartType.type === "bubble") {
    context.copyValue(objChartType, "bubbleScale", xmlChartTypeNode, "c:bubbleScale", setChildValAttribute, alwaysCopyCheck);
    context.copyValue(objChartType, "showNegativeBubbleValues", xmlChartTypeNode, "c:showNegBubbles", setChildValAttrAsBoolean, alwaysCopyCheck);
    context.copyValue(objChartType, "bubbleSizeRepresentsWidth", xmlChartTypeNode, "c:sizeRepresents", setChildValAttrAsBoolean, alwaysCopyCheck);
  }

  if (objChartType.type === "scatter") {
    context.copyValue(objChartType, "scatterStyle", xmlChartTypeNode, "c:scatterStyle", setChildValAttribute, alwaysCopyCheck);
  }

  context.copyValue(objChartType, "varyColors", xmlChartTypeNode, "c:varyColors", setChildValAttrAsBoolean, alwaysCopyCheck);

  //TODO: chart series - use offsetChart to pick the right objChartType
  if (context.getParentModel().series) {
    let arraylength = context.getParentModel().series.length
    for (let i = 0; i < arraylength; i++) {
      let objChartSeries = context.getParentModel().series.getAt(i);
      let xmlSerNode = context.visit(xmlChartTypeNode, objChartSeries, "c:ser");
      if (xmlSerNode !== null) {
        let orderNode = context.getNode(xmlSerNode, "c:order");
        context.setAttribute(orderNode, "val", i);
      }
    }
  }

  //data label
  let dataLabels = objChartType.dataLabels
  // if (dataLabels && dataLabels.shown === true) {
  if (dataLabels) {
    context.visit(xmlChartTypeNode, dataLabels, "c:dLbls");
  }

  if (objChartType.type === "bar" || objChartType.type === "column" || objChartType.type === "line") {
    context.copyValue(objChartType, "gapWidth", xmlChartTypeNode, "c:gapWidth", function(context, xmlNode, xpath, attrValue) {
      let gapWidth = attrValue*100;
      setChildValAttribute(context, xmlNode, xpath, gapWidth);
    }, alwaysCopyCheck);

    context.copyValue(objChartType, "overlap", xmlChartTypeNode, "c:overlap", function(context, xmlNode, xpath, attrValue) {
      let overlap = attrValue*100;
      setChildValAttribute(context, xmlNode, xpath, overlap);
    }, alwaysCopyCheck);
  }

  if (objChartType.type === "line") {
    let scatterStyle = objChartType.scatterStyle;
    if (scatterStyle) {
      if (scatterStyle.toLowerCase().includes("marker")) {
        let markerNode = context.createChildNode(xmlChartTypeNode, "c:marker");
        context.setAttribute(markerNode, 'val', 1);
      }
      if (scatterStyle.toLowerCase().includes("smooth")) {
        let markerNode = context.createChildNode(xmlChartTypeNode, "c:smooth");
        context.setAttribute(markerNode, 'val', 1);
      }
    }

    context.copyValue(objChartType, "gapWidth", xmlChartTypeNode, "c:gapWidth", function(context, xmlNode, xpath, attrValue) {
      let gapWidth = attrValue*100;
      setChildValAttribute(context, xmlNode, xpath, gapWidth);
    }, alwaysCopyCheck);

    context.copyValue(objChartType, "overlap", xmlChartTypeNode, "c:overlap", function(context, xmlNode, xpath, attrValue) {
      let overlap = attrValue*100;
      setChildValAttribute(context, xmlNode, xpath, overlap);
    }, alwaysCopyCheck);
  }

  if (objChartType.type === "pie") {
    context.copyValue(objChartType, "startAngle", xmlChartTypeNode, "c:firstSliceAng", setChildValAttribute, alwaysCopyCheck);
    if (objChartType.holeSize > 0)
      context.copyValue(objChartType, "holeSize", xmlChartTypeNode, "c:holeSize", setChildValAttribute, alwaysCopyCheck);
  }
}

function processDataLabel(
  context: ToOOXMLConverter,
  modelDataLabel: any,
  nodeDataLabel: PartialElement,
  processExtendedProperties=true,
  positionCopy=defaultCopyCheck
): void {
  //numFmt
  processNumFormat(context, modelDataLabel, nodeDataLabel);

  //check if any of the attributes is true
  if (processExtendedProperties && (
    modelDataLabel.showLegendKey ||
    modelDataLabel.showVal ||
    modelDataLabel.showCatName ||
    modelDataLabel.showSerName ||
    modelDataLabel.showPercentage ||
    modelDataLabel.showBubbleSize ||
    modelDataLabel.showLeaderLines)) {
    //shape pr
    processShapeProperties(context, modelDataLabel, nodeDataLabel);
    //tx pr
    context.visit(nodeDataLabel, modelDataLabel.text, "c:txPr");
  }

  // Note - Excel does not read this from the type defaults even though it sets it.
  context.copyValue(modelDataLabel, "position", nodeDataLabel, "c:dLblPos", setChildValAttribute, positionCopy);

  context.copyValue(modelDataLabel, "showLegendKey", nodeDataLabel, "c:showLegendKey", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(modelDataLabel, "showVal", nodeDataLabel, "c:showVal", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(modelDataLabel, "showCatName", nodeDataLabel, "c:showCatName", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(modelDataLabel, "showSerName", nodeDataLabel, "c:showSerName", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(modelDataLabel, "showPercentage", nodeDataLabel, "c:showPercent", setChildValAttrAsBoolean, alwaysCopyCheck);
  context.copyValue(modelDataLabel, "showBubbleSize", nodeDataLabel, "c:showBubbleSize", setChildValAttrAsBoolean, alwaysCopyCheck);

  //separator
  context.copyValue(modelDataLabel, "separator", nodeDataLabel, "c:separator", function(context, _xmlNode, _xpath, _separatorValue) {
    let separatorNode = context.createChildNode(nodeDataLabel, "c:separator");
    let separatorValNode = context.createTextNode(modelDataLabel.separator);
    context.appendChildNode(separatorNode, separatorValNode);
  });

  context.copyValue(modelDataLabel, "showLeaderLines", nodeDataLabel, "c:showLeaderLines", setChildValAttrAsBoolean, alwaysCopyCheck);
  let leaderLinesProp = modelDataLabel.getPropertyValue("leaderLines");
  if (leaderLinesProp && leaderLinesProp.isExplicit) {
    let leaderLinesNode = context.createNode("c:leaderLines");
    //shape pr
    processShapeProperties(context, modelDataLabel.leaderLines, leaderLinesNode);
    context.appendNonEmptyChildNode(nodeDataLabel, leaderLinesNode);
  }
}

function dataLabelShapeVisitor(context: ToOOXMLConverter, objDataLabelShape: any, dLblsNode): void {
    // const copyIfChartType = function(property) {
    //   return (property !== undefined && property.isExplicit && property.value !== undefined)
    //       || (property !== undefined &&  property.value !== undefined && getAnyClass(context.getParentModel()) === 'ChartType');
    // }

    // const copyIfSeriesType = function(property) {
    //   return (property !== undefined && property.isExplicit && property.value !== undefined)
    //       || (property !== undefined &&  property.value !== undefined
    //           && (getAnyClass(context.getParentModel()) === 'ChartSeriesShape')
    //               || (getAnyClass(context.getParentModel()) === 'ChartPieSeriesShape')
    //               || (getAnyClass(context.getParentModel()) === 'ChartScatterSeriesShape'));
    // }

    // const copyIfPieChartType = function(property) {
    //   return (property !== undefined && property.isExplicit && property.value !== undefined)
    //               || (property !== undefined
    //                   &&  property.value !== undefined
    //                   && getAnyClass(context.getParentModel()) === 'ChartType'
    //                   && ChartUtils.isSingleSeries(context.getParentModel().type));
    // }

  //delete
  if (!objDataLabelShape.shown)
    context.copyValue(objDataLabelShape, "shown", dLblsNode, "c:delete", setChildValAttrAsBooleanFlip);

  if ((getAnyClass(context.getParentModel()) === 'ChartSeriesShape')
    || (getAnyClass(context.getParentModel()) === 'ChartPieSeriesShape')
    || (getAnyClass(context.getParentModel()) === 'ChartScatterSeriesShape')) {
    let points = objDataLabelShape.points;
    let pointsLength = points.length;
    for (let i = 0; i < pointsLength; i++) {
      let point  = points.getAt(i);
      if (point) {
        let dLblNode = context.createChildNode(dLblsNode, "c:dLbl");
        let idxNode = context.createChildNode(dLblNode, "c:idx");
        context.setAttribute(idxNode, "val", i);
        processDataLabel(context, point, dLblNode);
      }
    }

    let positionProp = objDataLabelShape.getPropertyValue("series.chartType.dataLabels.position");
    const copyIfPositionIsExplicit = function(property) {
      return defaultCopyCheck(property) || (positionProp && positionProp.isExplicit);
    }

    processDataLabel(context, objDataLabelShape, dLblsNode, true/*processExtendedProperties*/, copyIfPositionIsExplicit);
  } else { //(getAnyClass(context.getParentModel()) === 'ChartType'
    processDataLabel(context, objDataLabelShape, dLblsNode, false/*processExtendedProperties*/);
  }
}

function processTitleText(context: ToOOXMLConverter, objChartTitleShape: any, xmlParentNode: PartialElement, isSeries?: boolean) {
  let simpleRunProp = objChartTitleShape.getPropertyValue("text.simpleRun");
  if (!simpleRunProp) {
    debugger;
    return;
  }
  if (simpleRunProp.isExplicit) {
    if (isSeries) { // series write their shape properties to legend entry and only write the value here
      let xmlTxNode = context.createChildNode(xmlParentNode, "c:tx");
      let xmlVNode = context.createChildNode(xmlTxNode, "c:v");
        context.appendChildNode(xmlVNode, context.createTextNode(simpleRunProp.value));
    } else
      txRichVisitor(context, objChartTitleShape.text, xmlParentNode, false);
  } else if (objChartTitleShape.range) {
    let titleRange = objChartTitleShape.range.toString();
    let xmlTxNode = context.createChildNode(xmlParentNode, "c:tx");
    let xmlStrRefNode = context.createChildNode(xmlTxNode, "c:strRef");
    let xmlFNode = context.createChildNode(xmlStrRefNode, "c:f");
    context.appendChildNode(xmlFNode, context.createTextNode(titleRange));
    let titleValues = objChartTitleShape.values;
    if (titleValues) {
      // TODO - this can be an array.
      let xmlStrCacheNode = context.createChildNode(xmlStrRefNode, "c:strCache");
      setChildAttribute(context, xmlStrCacheNode, "c:ptCount", "val", titleValues.length);
      let asCells = titleValues.asCells;
      for (let i=0; i<asCells[0].length; i++) {
        let xmlPointNode = context.createChildNode(xmlStrCacheNode, "c:pt");
        context.setAttribute(xmlPointNode, "idx", i);
        let xmlVNode = context.createChildNode(xmlPointNode, "c:v");
        let xmlValNode = context.createTextNode(OOXMLUtils.stringFromCells([[asCells[0][i]]]));
        context.appendChildNode(xmlVNode, xmlValNode);
      }
    }
  }
}

function chartSeriesVisitor(context: ToOOXMLConverter, objChartSeries: any, xmlSerNode): void {
    const copyIfLineChartType = function(property) {
      return (property !== undefined && property.isExplicit && property.value !== undefined)
              || (property !== undefined
                  &&  property.value !== undefined
                  && getAnyClass(context.getParentModel()) === 'ChartType'
                  && OOXMLUtils.isLineType(context.getParentModel().type));
    }
    //c:idx
    context.copyValue(objChartSeries, "idx", xmlSerNode, "c:idx", setChildValAttribute, alwaysCopyCheck);
    //placeholder c:order
    let _orderNode = context.createChildNode(xmlSerNode, "c:order");
    //data points
    let boolVaryColors = (context.getParentModel().varyColors === true);
    let pointsLength = boolVaryColors ? objChartSeries.renderedPoints.length : objChartSeries.points.length;
    for (let i=0; i<pointsLength; i++) {
      let objPoint = boolVaryColors ? objChartSeries.renderedPoints[i] : objChartSeries.points.getAt(i);
      if (objPoint) {
        let dPtNode = context.createChildNode(xmlSerNode, "c:dPt");
        setChildValAttribute(context, dPtNode, "c:idx", i);
        processShapeProperties(context, objPoint, dPtNode, alwaysCopyCheck);
      }
    }

    processTitleText(context, objChartSeries.title, xmlSerNode, true/*isSeries*/);

    //shape pr
    let shapeCopyCheck = alwaysCopyCheck;
    let fillPropName = "fill";
    if (getAnyClass(objChartSeries) === 'ChartScatterSeriesShape') {
         fillPropName = null;
    }
    processShapeProperties(context, objChartSeries, xmlSerNode, shapeCopyCheck, fillPropName);

    //negative fill
    let invNegativeNode = context.createChildNode(xmlSerNode, "c:invertIfNegative");
    let fillNegative = objChartSeries.getPropertyValue("fillNegative");
    let strokeNegative = objChartSeries.getPropertyValue("strokeNegative");
    if ((fillNegative && fillNegative.isExplicit) || (strokeNegative && strokeNegative.isExplicit)) {
        context.setAttribute(invNegativeNode, "val", "1");
    } else {
        context.setAttribute(invNegativeNode, "val", "0");
    }
    //data label
    let dataLabels = objChartSeries.labels;
    if (dataLabels && dataLabels.shown === true) {
        context.visit(xmlSerNode, dataLabels, "c:dLbls");
    }
    //marker
    let objMarkerShape = objChartSeries.markers;
    if (objMarkerShape) {
        context.visit(xmlSerNode, objMarkerShape, "c:marker");
    }
    //xRange
    let xmlValNode = (objChartSeries.chartType.type === "scatter") ?  context.createNode("c:xVal") : context.createNode("c:cat");
    processRange(context, objChartSeries, objChartSeries.xRange, "xValues", "pointX", xmlValNode);
    context.appendNonEmptyChildNode(xmlSerNode, xmlValNode);
    //valRange
    xmlValNode = (objChartSeries.chartType.type === "scatter") ?  context.createNode("c:yVal") : context.createNode("c:val");
    processRange(context, objChartSeries, objChartSeries.valRange, "valValues", "pointVal", xmlValNode);
    context.appendNonEmptyChildNode(xmlSerNode, xmlValNode);

    context.copyValue(objChartSeries, "smooth", xmlSerNode, "c:smooth", setChildValAttrAsBoolean, copyIfLineChartType);

    if ((fillNegative && fillNegative.isExplicit) || (strokeNegative && strokeNegative.isExplicit)) {
        let extListNode = context.createChildNode(xmlSerNode, "c:extLst");
        let extNode = context.createChildNode(extListNode, "c:ext");
        context.setAttribute(extNode, "uri", "{6F2FDCE9-48DA-4B69-8628-5D25D57E5C99}");
        context.setAttribute(extNode, "xmlns:c14", "http://schemas.microsoft.com/office/drawing/2007/8/2/chart");
        let invertSolidFillFmtNode = context.createChildNode(extNode, "c14:invertSolidFillFmt");

        //shape pr
        let xmlShapePrNode = context.createNode("c14:spPr");
        context.setAttribute(xmlShapePrNode, "xmlns:c14", "http://schemas.microsoft.com/office/drawing/2007/8/2/chart");
        processFill(context, objChartSeries, xmlShapePrNode, "fillNegative");
        let strokeChildNode = context.createNode("a:ln");
        processFill(context, objChartSeries, strokeChildNode, "strokeFillNegative");
        if (!strokeChildNode.hasChildNodes()) {
             context.createChildNode(strokeChildNode, "a:noFill");
        };

        context.appendNonEmptyChildNode(xmlShapePrNode, strokeChildNode);
        context.appendNonEmptyChildNode(invertSolidFillFmtNode, xmlShapePrNode);
    }

    /*
          <c:extLst>
            <c:ext uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://schemas.microsoft.com/office/drawing/2014/chart">
              <c16:uniqueId val="{0 000 000 0-A9AA-D14C-8179-DC07CEE7D30A}"/>
            </c:ext>
          </c:extLst>
    */
    let extListNode = context.createChildNode(xmlSerNode, "c:extLst");
    let extNode = context.createChildNode(extListNode, "c:ext");
    context.setAttribute(extNode, "uri", "{C3380CC4-5D6E-409C-BE32-E72D297353CC}");
    context.setAttribute(extNode, "xmlns:c16", "http://schemas.microsoft.com/office/drawing/2014/chart");
    let c16Node = context.createChildNode(extNode, "c16:uniqueId");
    context.setAttribute(c16Node, "val", "{" + getC16UriCount(context)+"-A9AA-D14C-8179-DC07CEE7D30A}");
}

function getC16UriCount(context: ToOOXMLConverter): string {
  let counter = context.c16UniqueIdCounter++;
  return String(counter).padStart(8, '0');
}

function processRange(context: ToOOXMLConverter, objSeriesShape: any, range, literalValProp/*xValues or valValues*/, pointCoordProp/*pointX or pointVal*/, xmlValNode: PartialElement): void {
  if (range === null)
    return;
  if (range.isLiteralRange) {
    if (objSeriesShape.xValues?.asCells?.length > 0) {
      let primitives = [];
      let literalValues = objSeriesShape.getPropertyValue(literalValProp).value.asCells[0];
      let isNumericList = true;
      for (let i = 0; i < literalValues.length; i++) {
        primitives.push({"value":literalValues[i].v, "index":i});
        isNumericList = isNumericList && (literalValues[i].t === 'n');
      }
      let xmlValListNode = isNumericList ? context.createChildNode(xmlValNode, "c:numLit") : context.createChildNode(xmlValNode, "c:strLit");
      OOXMLUtils.createDataList(context, primitives, xmlValListNode);
      context.appendNonEmptyChildNode(xmlValNode, xmlValListNode);
    }
  } else if (OOXMLUtils.isMultiLevel(objSeriesShape, pointCoordProp)) {//multi level cell range
    //multi level is never numeric
    let xmlRefNode = context.createChildNode(xmlValNode, "c:multiLvlStrRef");
    let xmlFNode = context.createChildNode(xmlRefNode, "c:f");
    let xmlRangeNode = context.createTextNode(range.toString())
    context.appendChildNode(xmlFNode, xmlRangeNode);
    let valueAndFormatCodes = OOXMLUtils.getValues(objSeriesShape, pointCoordProp, true);
    let values = valueAndFormatCodes.values;
    if (values.length > 0) {
      //multi level is never numeric
      let xmlCacheNode = context.createChildNode(xmlRefNode, "c:multiLvlStrCache");
      setChildAttribute(context, xmlCacheNode, "c:ptCount", "val", objSeriesShape.renderedPoints.length);
      for (let i=0; i<values.length; i++) {
        let xmlLvlNode = context.createChildNode(xmlCacheNode, "c:lvl");
        OOXMLUtils.createDataList(context, values[i], xmlLvlNode);
      }
    }
  } else {//single level cell range
    let valueAndFormatCodes = OOXMLUtils.getValues(objSeriesShape, pointCoordProp);
    let listFormatCode = valueAndFormatCodes.listFormatCode;

    let xmlRefNode = null;
    if (valueAndFormatCodes.isNumericList) {
      xmlRefNode = context.createChildNode(xmlValNode, "c:numRef");
    } else {
      xmlRefNode = context.createChildNode(xmlValNode, "c:strRef");
    }
    let xmlFNode = context.createChildNode(xmlRefNode, "c:f");
    let xmlRangeNode = context.createTextNode(range.toString())
    context.appendChildNode(xmlFNode, xmlRangeNode);
    //data cache
    let values = valueAndFormatCodes.values;
    if (values[0].length > 0) {
      let xmlCacheNode = null;
      if (valueAndFormatCodes.isNumericList) {
        xmlCacheNode = context.createChildNode(xmlRefNode, "c:numCache");
      } else {
        xmlCacheNode = context.createChildNode(xmlRefNode, "c:strCache");
      }
      if (valueAndFormatCodes.isNumericList) {
        let xmlFCNode = context.createChildNode(xmlCacheNode, "c:formatCode");
        let xmlFCTextNode = context.createTextNode(listFormatCode);
        context.appendChildNode(xmlFCNode, xmlFCTextNode);
      }
      setChildAttribute(context, xmlCacheNode, "c:ptCount", "val", objSeriesShape.renderedPoints.length);
      OOXMLUtils.createDataList(context, values[0], xmlCacheNode, (valueAndFormatCodes.allSameFormatCodes === false) && valueAndFormatCodes.isNumericList, valueAndFormatCodes.formatCodes);
    }
  }
}

function chartSeriesMarkerShapeVisitor(context: ToOOXMLConverter, objMarkerShape: any, markerNode: PartialElement): void {
  const copyIfScatterChartType = function(property) {
    return (property !== undefined && property.isExplicit && property.value !== undefined)
        || (property !== undefined
        &&  property.value !== undefined
        && (getAnyClass(context.getParentModel()) === 'ChartSeriesShape'
        || getAnyClass(context.getParentModel()) === 'ChartPieSeriesShape'
        || getAnyClass(context.getParentModel()) === 'ChartScatterSeriesShape')
        && context.getParentModel().chartType.type === "scatter");
  }

  let type = objMarkerShape.type;

  if (type === "none"
    && (getAnyClass(context.getParentModel()) === 'ChartSeriesShape'
    || getAnyClass(context.getParentModel()) === 'ChartPieSeriesShape'
    || getAnyClass(context.getParentModel()) === 'ChartScatterSeriesShape')
    && OOXMLUtils.isLineType(context.getParentModel().chartType.type) === false) {
    return;
  }
  context.copyValue(objMarkerShape, "type", markerNode, "c:symbol", setChildValAttribute, alwaysCopyCheck);
  context.copyValue(objMarkerShape, "size", markerNode, "c:size", setChildValAttribute, copyIfScatterChartType);

  if (type !== "none")
    processShapeProperties(context, objMarkerShape, markerNode);

  if (objMarkerShape.points) {
    let dPtNodes = context.getParentNode().getElementsByTagName("c:dPt");
    let pointsLength = objMarkerShape.points.length;
    for (let i = 0; i < pointsLength; i++) {
      //ChartDataPointMarkerShape
      let point = objMarkerShape.points.getAt(i);
      if (point) {
        let dPtNode = OOXMLUtils.getDPt(context, dPtNodes, i);
        if (!dPtNode) {
          dPtNode = context.createChildNode(context.getParentNode(), "c:dPt");
          setChildValAttribute(context, dPtNode, "c:idx", i);
        }
        let dPtMarkerNode = context.createChildNode(dPtNode, "c:marker");
        chartSeriesMarkerShapeVisitor(context, point, dPtMarkerNode);
      }
    }
  }
}

function chartAxisVisitor(context: ToOOXMLConverter, objChartAxisShape: any, xmlChartAxisNode: PartialElement): void {
  let axisId = context.axisIds.get(objChartAxisShape);
  let axisIdNode = context.createChildNode(xmlChartAxisNode, "c:axId");
  context.setAttribute(axisIdNode, "val", axisId);
  processScaling(context, objChartAxisShape, xmlChartAxisNode);
  context.copyValue(objChartAxisShape, "shown", xmlChartAxisNode, "c:delete", setChildValAttrAsBooleanFlip, alwaysCopyCheck);
  processOrientation(context, objChartAxisShape, xmlChartAxisNode);
  //gridlines
  if (objChartAxisShape.gridLinesMajor.shown) {
    let gridLinesMajorNode = context.createChildNode(xmlChartAxisNode, "c:majorGridlines");
    processShapeProperties(context, objChartAxisShape.gridLinesMajor, gridLinesMajorNode, alwaysCopyCheck, null/*fillProp*/);
  }
  if (objChartAxisShape.gridLinesMinor.shown) {
    let gridLinesMinorNode = context.createChildNode(xmlChartAxisNode, "c:minorGridlines");
    processShapeProperties(context, objChartAxisShape.gridLinesMinor, gridLinesMinorNode, alwaysCopyCheck, null/*fillProp*/);
  }
  //title
  let axisTitleProperty = objChartAxisShape.getPropertyValue("title");
  if (axisTitleProperty && axisTitleProperty.value && axisTitleProperty.value.shown === true)
    context.visit(xmlChartAxisNode, objChartAxisShape.title, "c:title");
processNumFormat(context, objChartAxisShape.labels, xmlChartAxisNode);
  context.copyValue(objChartAxisShape, "majorTickMarks", xmlChartAxisNode, "c:majorTickMark", setChildValAttribute, alwaysCopyCheck);
  context.copyValue(objChartAxisShape, "minorTickMarks", xmlChartAxisNode, "c:minorTickMark", setChildValAttribute, alwaysCopyCheck);

  // because office uses the label none to determine if labels are hidden but sheetxl also has a shown flag we also check this.
  if (!objChartAxisShape.labels.shown) {
    let tickLblPos = context.createChildNode(xmlChartAxisNode, "c:tickLblPos");
    context.setAttribute(tickLblPos, "val", "none");
  } else
    context.copyValue(objChartAxisShape, "labelPosition", xmlChartAxisNode, "c:tickLblPos", setChildValAttribute, alwaysCopyCheck);

  // for axis the stroke is just the stroke but sheetxl 'label.fill' maps to axis.fill
  let xmlShapePrNode = context.createNode("c:spPr");
  processFill(context, objChartAxisShape, xmlShapePrNode, "labels.fill"/*fillProp*/, alwaysCopyCheck);
  processStroke(context, objChartAxisShape, xmlShapePrNode, alwaysCopyCheck);
  context.appendNonEmptyChildNode(xmlChartAxisNode, xmlShapePrNode);

  let axisType = getAnyClass(objChartAxisShape);
  //txPr properties
  let labelsTextProperty = objChartAxisShape.labels.getPropertyValue("text");
  context.visit(xmlChartAxisNode, labelsTextProperty.value, "c:txPr");

  let crossAx = objChartAxisShape.crossAx;
  if (crossAx) {
    let crossAxId = context.axisIds.get(crossAx);
    let crossAxNode = context.createChildNode(xmlChartAxisNode, "c:crossAx");
    context.setAttribute(crossAxNode, "val", crossAxId);
  }
  let crosses = objChartAxisShape.crosses;
  if (crosses === "autoZero" || crosses === "min" || crosses === "max") {
    setChildAttribute(context, xmlChartAxisNode, "c:crosses", "val", crosses);
  } else {
    setChildAttribute(context, xmlChartAxisNode, "c:crossesAt", "val", crosses);
  }
  processLabelAlign(context, objChartAxisShape, axisType, xmlChartAxisNode);
  if (axisType === "ChartOrdAxisShape" || axisType === "ChartDateAxisShape") {
    context.copyValue(objChartAxisShape, "labelOffset", xmlChartAxisNode, "c:lblOffset", setChildValAttribute, alwaysCopyCheck);
  }
  if (axisType === "ChartOrdAxisShape" || axisType === "ChartDateAxisShape") {
    context.copyValue(objChartAxisShape, "tickMarkSkip", xmlChartAxisNode, "c:tickMarkSkip", setChildValAttribute);
    context.copyValue(objChartAxisShape, "labelInterval", xmlChartAxisNode, "c:tickLblSkip", setChildValAttribute);
  }
  context.copyValue(objChartAxisShape, "labelMultiLevel", xmlChartAxisNode, "c:noMultiLvlLbl", setChildValAttrAsBooleanFlip, alwaysCopyCheck);

  //crossAx
  context.copyValue(objChartAxisShape, "crossAx.crossBetween", xmlChartAxisNode, "c:crossBetween", setChildValAttribute, alwaysCopyCheck);

  if (axisType === "ChartDateAxisShape")
    context.copyValue(objChartAxisShape, "baseUnitDates", xmlChartAxisNode, "c:baseTimeUnit", setChildValAttribute, alwaysCopyCheck);

  if (axisType === "ChartValAxisShape" || axisType === "ChartDateAxisShape") {
    processTimeUnits(context, objChartAxisShape, xmlChartAxisNode, "majorUnitDates", "c:majorTimeUnit", "c:majorUnit");
    processTimeUnits(context, objChartAxisShape, xmlChartAxisNode, "minorUnitDates", "c:minorTimeUnit", "c:minorUnit");
  }
  if (axisType === "ChartValAxisShape") {
    let displayUnitsProperty = objChartAxisShape.getPropertyValue("displayUnits");
    if (displayUnitsProperty.isExplicit || objChartAxisShape.displayUnitsLabel.shown === true) {
      let dispUnits = displayUnitsProperty.value;
      let builtin = OOXMLUtils.builtInDisplayUnits[dispUnits];
      if (builtin)
        context.copyValue(objChartAxisShape, "displayUnits", xmlChartAxisNode, "c:dispUnits/c:builtInUnit", setChildValAttribute, alwaysCopyCheck);
      else
        context.copyValue(objChartAxisShape, "displayUnits", xmlChartAxisNode, "c:dispUnits/c:custUnit", setChildValAttribute, alwaysCopyCheck);
    }

    if (objChartAxisShape.displayUnitsLabel.shown === true) {
      let dispUnitsLblNode = context.createChildNodes(xmlChartAxisNode, "c:dispUnits/c:dispUnitsLbl");
      //tx/rich
      let objDisplayUnitsLabelText = objChartAxisShape.displayUnitsLabel.text;
      txRichVisitor(context, objDisplayUnitsLabelText, dispUnitsLblNode, true);
      //sh pr
      processShapeProperties(context, objChartAxisShape.displayUnitsLabel, dispUnitsLblNode, alwaysCopyCheck);
    }
  }
}

function processTimeUnits(
  context: ToOOXMLConverter,
  objChartAxisShape: any,
  xmlChartAxisNode: PartialElement,
  propertyPath: string,
  timeUnitXPath: string,
  unitXPath: string
): void {
  let propertyPathInstance = objChartAxisShape.getPropertyValue(propertyPath);
  if (propertyPathInstance && propertyPathInstance.isExplicit && propertyPathInstance.value) {
      let propertyValue = propertyPathInstance.value;
      setChildValAttribute(context, xmlChartAxisNode, "c:"+unitXPath, propertyValue.amt);
      setChildValAttribute(context, xmlChartAxisNode, "c:"+timeUnitXPath, propertyValue.dem);
  }
}

function processScaling(context: ToOOXMLConverter, objChartAxiShape: any, xmlChartAxisNode: PartialElement): void {
  context.copyValue(objChartAxiShape, "inverted", xmlChartAxisNode, "c:scaling/c:orientation",
    function(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any): void {
      if (attrValue) {
        setChildAttribute(context, xmlNode, xpath, "val", "maxMin")
      } else {
        setChildAttribute(context, xmlNode, xpath, "val", "minMax")
      }
    },
    () => {
      return true;
    }
  );
  //logBase
  if (objChartAxiShape.scaleType === "log") {
    context.copyValue(objChartAxiShape, "logBase", xmlChartAxisNode, "c:scaling/c:logBase", setChildValAttribute, alwaysCopyCheck);
  }
  context.copyValue(objChartAxiShape, "max", xmlChartAxisNode, "c:scaling/c:max", setChildValAttribute);
  context.copyValue(objChartAxiShape, "min", xmlChartAxisNode, "c:scaling/c:min", setChildValAttribute);
}

function processOrientation(context: ToOOXMLConverter, objChartAxiShape: any, xmlChartAxisNode: PartialElement): void {
  context.copyValue(objChartAxiShape, "orientation", xmlChartAxisNode, "c:axPos", function(context, xmlNode, xpath, attrValue) {
    let orientationTextVal = null;
    if (attrValue === "bottom") {
        orientationTextVal = "b";
    }
    if (attrValue === "left") {
        orientationTextVal = "l";
    }
    if (attrValue === "right") {
        orientationTextVal = "r";
    }
    if (attrValue === "top") {
        orientationTextVal = "t";
    }
    setChildValAttribute(context, xmlNode, xpath, orientationTextVal);
  }, alwaysCopyCheck);
}

function processNumFormat(context: ToOOXMLConverter, model: any, node: PartialElement): void {
  let labelFormatCodeProp = model.getPropertyValue("formatCode");
  if (labelFormatCodeProp) {
    let xmlNumFmtNode = context.createChildNode(node, "c:numFmt");
    context.setAttribute(xmlNumFmtNode, "formatCode", labelFormatCodeProp.value);
    let labelSourceLinked = model.sourceLinked;
    xmlNumFmtNode.setAttribute("sourceLinked", '' + (labelSourceLinked === true ? 1 : 0));
  }
}

function processLabelAlign(context: ToOOXMLConverter, objChartAxiShape: any, axisType, xmlChartAxisNode: PartialElement): void {
  if (axisType === "ChartOrdAxisShape" || axisType === "ChartDateAxisShape") {
      context.copyValue(objChartAxiShape, "labelAlign", xmlChartAxisNode, "c:lblAlgn",
        function(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any): void {
          let labelAlignTextVal = null;
          if (attrValue === "center") {
            labelAlignTextVal = "ctr";
          }
          if (attrValue === "left") {
            labelAlignTextVal = "l";
          }
          if (attrValue === "right") {
            labelAlignTextVal = "r";
          }
          setChildValAttribute(context, xmlNode, xpath, labelAlignTextVal);
      },
      alwaysCopyCheck
    );
  }
}

function titleVisitor(context: ToOOXMLConverter, objChartTitleShape: any, xmlTitleNode: PartialElement): void {
  //manual layout
  processLayout(context, objChartTitleShape, xmlTitleNode);
  //overlay
  context.copyValue(objChartTitleShape, "overlay", xmlTitleNode, "c:overlay", setChildValAttrAsBoolean, alwaysCopyCheck);

  processTitleText(context, objChartTitleShape, xmlTitleNode);

  //sh pr
  processShapeProperties(context, objChartTitleShape, xmlTitleNode, alwaysCopyCheck);

  //text
  let titleText = objChartTitleShape.text;
  if (titleText) {
      context.visit(xmlTitleNode, titleText, "c:txPr");
  }
}

function manualLayoutVisitor(context: ToOOXMLConverter, objManualLayout: any, xmlManualLayoutNode: PartialElement): void {
  if (objManualLayout.xMode) {
    let xModeNode = context.createChildNode(xmlManualLayoutNode, "c:xMode");
    context.setAttribute(xModeNode, "val", objManualLayout.xMode);
  }
  if (objManualLayout.yMode) {
    let yModeNode = context.createChildNode(xmlManualLayoutNode, "c:yMode");
    context.setAttribute(yModeNode, "val", objManualLayout.yMode);
  }
  if (objManualLayout.wMode) {
    let wModeNode = context.createChildNode(xmlManualLayoutNode, "c:wMode");
    context.setAttribute(wModeNode, "val", objManualLayout.wMode);
  }
  if (objManualLayout.hMode) {
    let hModeNode = context.createChildNode(xmlManualLayoutNode, "c:hMode");
    context.setAttribute(hModeNode, "val", objManualLayout.hMode);
  }
  if (objManualLayout.x) {
    let xNode = context.createChildNode(xmlManualLayoutNode, "c:x");
    context.setAttribute(xNode, "val", objManualLayout.x);
  }
  if (objManualLayout.y) {
    let yNode = context.createChildNode(xmlManualLayoutNode, "c:y");
    context.setAttribute(yNode, "val", objManualLayout.y);
  }
  if (objManualLayout.w) {
    let wNode = context.createChildNode(xmlManualLayoutNode, "c:w");
    context.setAttribute(wNode, "val", objManualLayout.w);
  }
  if (objManualLayout.h) {
    let hNode = context.createChildNode(xmlManualLayoutNode, "c:h");
    context.setAttribute(hNode, "val", objManualLayout.h);
  }
}

function hasExplicitValue(model: any): boolean {
  let foundExplicit = false;
  model.visitModel(
    [],
    new Map(),
    function (property, _value, _path) {
      if (property.evaled.explicit !== undefined && property.propertyName !== 'simpleRun') {
        foundExplicit = true;
      }
    }
  );
  return foundExplicit;
}

function chartLegendVisitor(context: ToOOXMLConverter, objChartLegendShape: any, xmlLegendNode: PartialElement): void {
  context.copyValue(objChartLegendShape, "position", xmlLegendNode, "c:legendPos", setChildValAttribute, alwaysCopyCheck);

  //series Title text formatting is mapped to legendEntries
  for (let i=0; i<objChartLegendShape.chartShape.series.length; i++) {
    let series = objChartLegendShape.chartShape.series.getAt(i);
    let legendEntry = series.title.text;
    let isDeleted = !series.title.shown;
    let writeTxPr = hasExplicitValue(legendEntry);

    if (!isDeleted && !writeTxPr)
      continue;

    let legendEntryNode = context.createChildNode(xmlLegendNode, "c:legendEntry");
    let idxNode = context.createChildNode(legendEntryNode, "c:idx");
    context.setAttribute(idxNode, "val", i);
    if (isDeleted) {
      let deleteNode = context.createChildNode(legendEntryNode, "c:delete");
      context.setAttribute(deleteNode, "val", "1");
    } else if (writeTxPr) { // we don't write explicits if deleted
      context.visit(legendEntryNode, legendEntry, "c:txPr");
    }
  }

  processLayout(context, objChartLegendShape, xmlLegendNode)
  context.copyValue(objChartLegendShape, "overlay", xmlLegendNode, "c:overlay", setChildValAttrAsBoolean, alwaysCopyCheck);

  processShapeProperties(context, objChartLegendShape, xmlLegendNode, alwaysCopyCheck);
  // text
  let labelText = objChartLegendShape.labels.text;
  if (labelText && labelText.shown === true)
    context.visit(xmlLegendNode, labelText, "c:txPr");
}

function txRichVisitor(context: ToOOXMLConverter, objChartTextShape: any, xmlNode: PartialElement, alwaysCopySimpleRun: boolean): void {
  let xmlTxNode = context.createChildNode(xmlNode, "c:tx");
  let richChildNode = context.createNode("c:rich");
  textVisitor(context, objChartTextShape, richChildNode);//, alwaysCopySimpleRun);

  let simpleRunProp = objChartTextShape.getPropertyValue("simpleRun");
  if (simpleRunProp.isExplicit || alwaysCopySimpleRun) {
    context.copyValue(objChartTextShape, "simpleRun", richChildNode, "a:p/a:r/a:t", function(context, xmlNode, xpath, textValue) {
      setChildValue(context, xmlNode, xpath, textValue);
    }, alwaysCopyCheck);
  }

  context.appendNonEmptyChildNode(xmlTxNode, richChildNode);
}

function txPrVisitor(context: ToOOXMLConverter, objChartTextShape: any, xmlTxPrNode: PartialElement): void {
  textVisitor(context, objChartTextShape, xmlTxPrNode);
}

function textVisitor(context: ToOOXMLConverter, objChartTextShape: any, textChildNode: PartialElement): void {
  let _propRot = objChartTextShape.parent.getPropertyValue("rotation");
  context.copyValue(objChartTextShape.parent, "rotation", textChildNode, "a:bodyPr", function(context, xmlNode: PartialElement, xpath: string, attrValue: any) {
//         if (attrValue === 0 && !propRot.isExplicit) {
//             attrValue = -1000; // office hack
//         }
    let rotation = OOXMLMappings.toOOXMLAngle(attrValue);
    setChildAttribute(context, xmlNode, xpath, "rot", rotation);
  }, alwaysCopyCheck);

  const xmlBodyPrNode = context.getNode(textChildNode, "a:bodyPr");

  context.setAttribute(xmlBodyPrNode, "spcFirstLastPara", "1");
  context.setAttribute(xmlBodyPrNode, "vertOverflow", "ellipsis");
  context.setAttribute(xmlBodyPrNode, "vert", "horz");
  context.setAttribute(xmlBodyPrNode, "wrap", "square");
  context.setAttribute(xmlBodyPrNode, "anchor", "ctr");
  context.setAttribute(xmlBodyPrNode, "anchorCtr", "1");

  context.copyValue(objChartTextShape, "size", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    let size = attrValue*100.0;
    setChildAttribute(context, xmlNode, xpath, "sz", size);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "weight", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    let weight = attrValue > 400 ? 1 : 0;
    setChildAttribute(context, xmlNode, xpath, "b", weight);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "italic", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    let italic =  attrValue === true ? 1 : 0;
    setChildAttribute(context, xmlNode, xpath, "i", italic);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "underline", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    setChildAttribute(context, xmlNode, xpath, "u", attrValue);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "strike", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    setChildAttribute(context, xmlNode, xpath, "strike", attrValue);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "kern", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    setChildAttribute(context, xmlNode, xpath, "kern", attrValue);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "spc", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    setChildAttribute(context, xmlNode, xpath, "spc", attrValue);
  }, alwaysCopyCheck);

  context.copyValue(objChartTextShape, "baseline", textChildNode, "a:p/a:pPr/a:defRPr", function(context, xmlNode, xpath, attrValue) {
    setChildAttribute(context, xmlNode, xpath, "baseline", attrValue);
  }, alwaysCopyCheck);

  //shape properties
  let xmlDefRPrNode = context.createChildNodes(textChildNode, "a:p/a:pPr/a:defRPr");
  processFill(context, objChartTextShape, xmlDefRPrNode, "fill", alwaysCopyCheck);
  processStroke(context, objChartTextShape, xmlDefRPrNode, alwaysCopyCheck);

  processFonts(context, objChartTextShape, xmlDefRPrNode, alwaysCopyCheck);
}

function processFont(context: ToOOXMLConverter, parent: any, font: any, type: string, defaultValue: any): void {
  let typeNode = context.createNode("a:" + type);
  context.setAttribute(typeNode, "typeface", font.isExplicit ? font.value.name : defaultValue);
  if (font.value.panose)
      context.setAttribute(typeNode, "panose", font.value.panose);
  if (font.value.pitchFamily)
      context.setAttribute(typeNode, "pitchFamily", font.value.pitch);
  if (font.value.charset)
      context.setAttribute(typeNode, "charset", font.value.charset);

  context.appendNonEmptyChildNode(parent, typeNode);
}

function processFonts(context: ToOOXMLConverter,  objChartTextShape: any, xmlDefRPrNode: PartialElement, copyCheck: (prop: any) => boolean): void {
  let font = objChartTextShape.getPropertyValue("font");

  if (copyCheck(font)) {
    processFont(context, xmlDefRPrNode, font, "latin", "+mn-lt");
  }

  let ea = context.createNode("a:ea");
  if (copyCheck(font))
      context.setAttribute(ea, "typeface", "+mn-ea");
  context.appendNonEmptyChildNode(xmlDefRPrNode, ea);

  let cs = context.createNode("a:cs");
  if (copyCheck(font))
    context.setAttribute(cs, "typeface", "+mn-cs");
  context.appendNonEmptyChildNode(xmlDefRPrNode, cs);
}

//TODO: ImmutableRect has x,y, width and height
function processFillToRect(context: ToOOXMLConverter, objImmutableRect: any, xmlNode: PartialElement): void {
  if (objImmutableRect.l) {
    context.setAttribute(xmlNode, "l", objImmutableRect.l*1000);
  }
  if (objImmutableRect.t) {
    context.setAttribute(xmlNode, "t", objImmutableRect.t*1000);
  }
  if (objImmutableRect.r) {
    context.setAttribute(xmlNode, "r", objImmutableRect.r*1000);
  }
  if (objImmutableRect.b) {
    context.setAttribute(xmlNode, "b", objImmutableRect.b*1000);
  }
}

// function processAlpha(context: ToOOXMLConverter, xmlNode: PartialElement, alpha: number=1): void {
//   alpha = ColorUtils.clampAlpha(parseFloat(alpha));
//   if (isNaN(alpha) || alpha === 1)
//       return;

//   let alphaChildNode = context.createChildNode(xmlNode, "a:alpha");
//   context.setAttribute(alphaChildNode, "val", alpha * 100 * 1000);
// }

// function processColorAdjustments(context: ToOOXMLConverter, adjs: any, xmlNode: PartialElement): void {
//   if (!adjs)
//       return;

//   let arraylength = adjs.length;
//   for (let i = 0; i < arraylength; i++) {
//     let type = adjs[i].type;
//     //create child element
//     let typeChildNode = context.createChildNode(xmlNode, "a:" + type);
//     let val = adjs[i].amount;
//     if (typeof val !== "boolean") {
//       //create val attribute
//       if (type === "hue" || type === "hueOff" || type === "hueMod")
//         val = OOXMLMappings.toOOXMLAngle(val);
//       else if (type === "gray" || type === "comp" || type === "inv" || type === "gamma" || type === "invGamma")
//         val = val*1;
//       else
//         val = val*1000;
//       context.setAttribute(typeChildNode, "val", val);
//     }
//   }
// }

// TODO - use new IColor
function processAdjColor(_context: ToOOXMLConverter, _color: any, _xmlNode: PartialElement): void {
}
// function processAdjColor(context: ToOOXMLConverter, color: any, xmlNode: PartialElement): void {
//   const colorVal = color.val

//   if (colorVal === null || colorVal === undefined)
//     return;

//   const presetClr = color.getType() === 'named';//_BuiltInColors.preset.valueOfName(colorVal)
//   if (presetClr) {
//     const prstClrChildNode = context.createChildNode(xmlNode, "a:prstClr");
//     context.setAttribute(prstClrChildNode, "val", colorVal);
//     processColorAdjustments(context, color.getAdjustments(), prstClrChildNode);
//     return;
//   }

//   const schemeClr = color.getType() === 'scheme';//_BuiltInColors.scheme(colorVal)
//   if (schemeClr) {
//     const schemeClrChildNode = context.createChildNode(xmlNode, "a:schemeClr");
//     context.setAttribute(schemeClrChildNode, "val", colorVal);
//     processColorAdjustments(context, color.getAdjustments(), schemeClrChildNode);
//     return;
//   }

//   // TODO - clear bug as this code will never get executed as the same was already searched.
//   // const sysClr = color.getType() === 'system';//_BuiltInColors.preset.valueOfName(colorVal);
//   // if (sysClr && sysClr.system === true) {
//   //   const sysClrChildNode = context.createChildNode(xmlNode, "a:sysClr");
//   //   context.setAttribute(sysClrChildNode, "val", colorVal);
//   //   let lastRGB = color.lastRGB;
//   //   if (lastRGB) {
//   //     //parse attributes
//   //     lastRGB = lastRGB.replace("rgb(", "")
//   //     lastRGB = lastRGB.replace(")", "")
//   //     let attrs = lastRGB.split(",")
//   //     let lastClr = Color.Utils.rgbToHex(attrs[0], attrs[1], attrs[2]);
//   //     context.setAttribute(sysClrChildNode, "lastClr", lastClr);
//   //   }
//   //   processColorAdjustments(context, color.getAdjustments(), sysClrChildNode);
//   //   return;
//   // }

//   let parts;
//   // hsl(a)
//   parts = colorVal.match(ColorUtils.RegExHSL) || colorVal.match(ColorUtils.RegExHSLA);
//   if (parts) {
//     const input = ColorUtils.parseParts(parts[1], parts[2], parts[3]);

//     const hslClrChildNode = context.createChildNode(xmlNode, "a:hslClr");
//     //parse attributes
//     context.setAttribute(hslClrChildNode, "hue", input[0]);
//     context.setAttribute(hslClrChildNode, "sat", input[1]);
//     context.setAttribute(hslClrChildNode, "lum", input[2]);
//     processAlpha(context, hslClrChildNode, parts[4]);
//     processColorAdjustments(context, color.getAdjustments(), hslClrChildNode);
//     return;
//   }

//   // rgba(a)
//   parts = colorVal.match(ColorUtils.RegExRGB) || colorVal.match(ColorUtils.RegExRGBA);
//   if (parts) {
//     const input = ColorUtils.parseParts(parts[1], parts[2], parts[3]);

//     const srgbClrChildNode = context.createChildNode(xmlNode, "a:srgbClr");
//     const hex = ColorUtils.rgbToHex(input[0], input[1], input[2]);

//     context.setAttribute(srgbClrChildNode, "val", hex);
//     processAlpha(context, srgbClrChildNode, parts[4]);
//     processColorAdjustments(context, color.getAdjustments(), srgbClrChildNode);
//     return;
//   }

//   // lrgb(a)
//   parts = colorVal.match(ColorUtils.RegExLRGB) || colorVal.match(ColorUtils.RegExLRGBA);
//   if (parts) {
//     let input = ColorUtils.parseParts(parts[1], parts[2], parts[3]);

//     let scRgbClrChildNode = context.createChildNode(xmlNode, "a:scrgbClr");
//     //parse attributes
//     context.setAttribute(scRgbClrChildNode, "r",  input[0]);
//     context.setAttribute(scRgbClrChildNode, "g", input[1]);
//     context.setAttribute(scRgbClrChildNode, "b", input[2]);
//     processAlpha(context, scRgbClrChildNode, parts[4]);
//     processColorAdjustments(context, color.getAdjustments(), scRgbClrChildNode);
//     return
//   }

//   // hex(a)
//   parts = colorVal.match(ColorUtils.RegExHEX) || parts.match(ColorUtils.RegExHEXA);
//   if (parts) {
//     let hex = colorVal;
//     let alpha = 1;
//     if (parts.length > 4) { // strip alpha
//       hex = ColorUtils.rgbToHex(
//         parseInt(parts[2], 16),
//         parseInt(parts[3], 16),
//         parseInt(parts[4], 16));
//       alpha = parseInt(parts[1], 16) / 255;
//     }

//     const srgbClrChildNode = context.createChildNode(xmlNode, "a:srgbClr");
//     context.setAttribute(srgbClrChildNode, "val", hex);
//     processAlpha(context, srgbClrChildNode, alpha);
//     processColorAdjustments(context, color.getAdjustments(), srgbClrChildNode);
//     return;
//   }
// }

function processChartType(context: ToOOXMLConverter, objChartSpace: any, objChartType: any, xmlPlotAreaNode: PartialElement): PartialElement {
  let xmlChartNodeName = null;
  if (objChartType.type === "bar" || objChartType.type === "column") {
    xmlChartNodeName = "c:barChart";
  } else {
    switch (objChartType.type) {
      case 'area' :
        xmlChartNodeName = "c:areaChart";
        break;
      case 'bubble' :
        xmlChartNodeName = "c:bubbleChart";
        break;
      case 'pie' :
        let holeSize = objChartType.holeSize
        if (holeSize > 0) {
          xmlChartNodeName = "c:doughnutChart";
        } else {
          xmlChartNodeName = "c:pieChart";
        }
        break;
      case 'line' :
        xmlChartNodeName = "c:lineChart";
        break;
      case 'scatter' :
        xmlChartNodeName = "c:scatterChart";
        break;
      default:
        // TODO - throw error or warn and fallback
        break;
    }
  }
  return context.visit(xmlPlotAreaNode, objChartType, xmlChartNodeName);
}

function processLayout(context: ToOOXMLConverter, objModel: any, xmlNode: PartialElement): void {
  let layoutProp = objModel.getPropertyValue("manualLayout");
  if (layoutProp && layoutProp.isExplicit && objModel.manualLayout) {
    let xmlLayoutNode = context.createNode("c:layout");
    let xmlManualLayoutNode = context.createNode("c:manualLayout");
    manualLayoutVisitor(context, objModel.manualLayout, xmlManualLayoutNode);
    context.appendNonEmptyChildNode(xmlLayoutNode, xmlManualLayoutNode);
    context.appendNonEmptyChildNode(xmlNode, xmlLayoutNode);
  }
}

function processEffectList(context: ToOOXMLConverter, objModel: any, xmlNode: PartialElement, copyCheck=defaultCopyCheck): void {
  let propEffects = objModel.getPropertyValue("effects");
  if (!copyCheck(propEffects))
    return;
  let xmlLayoutNode = context.createNode("a:effectLst");
  context.appendChildNode(xmlNode, xmlLayoutNode);
}

function processImageFill(_context: ToOOXMLConverter, _objFill: any, _xmlPatternFillNode: PartialElement): void {
  // TODO - implement. Perhaps will default to 'theme color'
}

function processPatternFill(context: ToOOXMLConverter, objFill: any, xmlPatternFillNode: PartialElement): void {
  xmlPatternFillNode.setAttribute("prst", objFill.patternType)

  let fgClrChildNode = context.createNode("a:fgClr");
  processAdjColor(context, objFill.foreground, fgClrChildNode);
  context.appendNonEmptyChildNode(xmlPatternFillNode, fgClrChildNode);

  let bgClrChildNode = context.createNode("a:bgClr");
  processAdjColor(context, objFill.background, bgClrChildNode);
  context.appendNonEmptyChildNode(xmlPatternFillNode, bgClrChildNode);
}

function processGradFill(context: ToOOXMLConverter, objFill: any, xmlGradFillNode: PartialElement): void {
  context.setAttribute(xmlGradFillNode, "flip", objFill.tile?.mirror)
  if (objFill.isRotatedWithShape !== undefined && objFill.isRotatedWithShape !== null) {
      xmlGradFillNode.setAttribute("rotWithShape", '' + (objFill.isRotatedWithShape ? 1 : 0));
  }

  if (objFill.stops) {
    let gsListChildNode = context.createNode("a:gsLst");
    let arraylength = objFill.stops.length
    for (let i = 0; i < arraylength; i++) {
      let gsChildNode = context.createNode("a:gs");
      gsChildNode.setAttribute("pos", '' + (objFill.stops[i].offset*1000));
      processAdjColor(context, objFill.stops[i].color, gsChildNode);
      context.appendNonEmptyChildNode(gsListChildNode, gsChildNode);
    }
    context.appendNonEmptyChildNode(xmlGradFillNode, gsListChildNode);
  }

  if ("linear" === objFill.gradientType) {
    let linChildNode = context.createNode("a:lin");
    context.setAttribute(linChildNode, "ang", OOXMLMappings.toOOXMLAngle(objFill.angle));
    //TODO:where is scaled attribute in gradFill
    context.setAttribute(linChildNode, "scaled", objFill.scaled);
    context.appendNonEmptyChildNode(xmlGradFillNode, linChildNode);
  } else {
    let pathChildNode = context.createNode("a:path");
    if (objFill.gradientType) {
      context.setAttribute(pathChildNode, "path", OOXMLMappings.toOOXMLGradientType(objFill.gradientType));
    }

    if (objFill.fillTo) {
      let fillToRectChildNode = context.createNode("a:fillToRect");
      processFillToRect(context, objFill.fillTo, fillToRectChildNode);
      context.appendNonEmptyChildNode(pathChildNode, fillToRectChildNode);
    }

    context.appendChildNode(xmlGradFillNode, pathChildNode);
  }

  if (objFill.tile?.bounds) {
    let tileRectChildNode = context.createChildNode(xmlGradFillNode, "a:tileRect");
    // TODO processFillRect is not finished
    processFillToRect(context, objFill.tile.bounds, tileRectChildNode);
  }
}

function processFill(context: ToOOXMLConverter, objModel: any, xmlNode: PartialElement, fillPropName: string="fill", copyCheck=defaultCopyCheck): void {
  if (fillPropName === null)
    return;
  let fillProperty = objModel.getPropertyValue(fillPropName);
  if (!copyCheck(fillProperty))
    return;

  let objFill = fillProperty.value;

  if (objFill.type === "none") {
    let _noFillChildNode = context.createChildNode(xmlNode, "a:noFill");
    return;
  }

  let nodeFill = null;
  if (objFill.type === "solid") {
    nodeFill = context.createNode("a:solidFill");
    processAdjColor(context, objFill.color, nodeFill);
  } else if (objFill.type === "gradient") {
    nodeFill = context.createNode("a:gradFill");
    processGradFill(context, objFill, nodeFill);
  } else if (objFill.type === "pattern") {
    nodeFill = context.createNode("a:pattFill");
    processPatternFill(context, objFill, nodeFill);
  } else if (objFill.type === "image") {
    nodeFill = context.createNode("a:blipFill");
    processImageFill(context, objFill, nodeFill);
  }
  context.appendNonEmptyChildNode(xmlNode, nodeFill);
}

function processStroke(context: ToOOXMLConverter, objModel: any, xmlNode: PartialElement, copyCheck=defaultCopyCheck): void {
  let strokeFillProperty = objModel.getPropertyValue("strokeFill");
  if (!copyCheck(strokeFillProperty))
    return;

  let strokeFill = strokeFillProperty.value;

  let strokeChildNode = context.createNode("a:ln");

  let strokeWidth = objModel.getPropertyValue("strokeWidth");
  if (copyCheck(strokeWidth))
    context.setAttribute(strokeChildNode, "w", OOXMLMappings.toOOXMLPoints(strokeWidth.value));

  let strokeLineCap = objModel.getPropertyValue("strokeLineCap");
  if (copyCheck(strokeLineCap))
    context.setAttribute(strokeChildNode, "cap", OOXMLMappings.toOOXMLLineCap(strokeLineCap.value));

  let strokeCompound = objModel.getPropertyValue("strokeCompound");
  if (copyCheck(strokeCompound))
    context.setAttribute(strokeChildNode, "cmpd", OOXMLMappings.toOOXMLCompound(strokeCompound.value));

  let strokeAlign = objModel.getPropertyValue("strokeAlign");
  if (copyCheck(strokeAlign))
    context.setAttribute(strokeChildNode, "algn", OOXMLMappings.toOOXMLAlign(strokeAlign.value));

  //process stroke fill
  processFill(context, strokeFillProperty.source, strokeChildNode, "strokeFill", () => {
    return copyCheck(strokeFillProperty);
  });

  if (strokeFill.type === "none") {
    context.appendNonEmptyChildNode(xmlNode, strokeChildNode);
    return;
  }

  //dash properties
  let strokeDashProperty = objModel.getPropertyValue("strokeDash");
  if (strokeDashProperty.isExplicit && objModel.strokeDash !== undefined && objModel.strokeDash !== null) {
    if (objModel.strokeDash.isPreset) {
      let prstDashChildNode = context.createChildNode(strokeChildNode, "a:prstDash");
      context.setAttribute(prstDashChildNode, "val", objModel.strokeDash.key);
    } else {//custom
      let custDashChildNode = context.createChildNode(strokeChildNode, "a:custDash");
      let dashArray = objModel.strokeDash.dashArray
      let arraylength = dashArray.length
      for (let i = 0; i < arraylength; i++) {
        let dashLength = dashArray[i]
        let spaceLength = dashArray[++i]
        let dsChildNode = context.createChildNode(custDashChildNode, "a:ds");
        context.setAttribute(dsChildNode, "a:d", dashLength);
        context.setAttribute(dsChildNode, "a:sp", spaceLength);
      }
    }
  }
  //join properties
  let strokeLineJoinProperty = objModel.getPropertyValue("strokeLineJoin");
  if (strokeLineJoinProperty.isExplicit && objModel.strokeLineJoin === "bevel")
    context.createChildNode(strokeChildNode, "a:bevel");
  else if (strokeLineJoinProperty.isExplicit && objModel.strokeLineJoin === "round")
    context.createChildNode(strokeChildNode, "a:round");

  //head and tail
  let strokeHeadTypeProp = objModel.getPropertyValue("strokeHeadType");
  if (strokeHeadTypeProp && strokeHeadTypeProp.isExplicit && objModel.strokeHeadType && objModel.strokeHeadSize) {
    let headEndNode = context.createChildNode(strokeChildNode, "a:headEnd");
    let size = objModel.strokeHeadSize.split("-");
    let w = size[0];
    let len = size[1];
    context.setAttribute(headEndNode, "len", len);
    context.setAttribute(headEndNode, "type", objModel.strokeHeadType);
    context.setAttribute(headEndNode, "w", w);
  }
  let strokeTailTypeProp = objModel.getPropertyValue("strokeTailType");
  if (strokeTailTypeProp && strokeTailTypeProp.isExplicit && objModel.strokeTailType && objModel.strokeTailSize) {
    let tailEndNode = context.createChildNode(strokeChildNode, "a:tailEnd");
    let size = objModel.strokeTailSize.split("-");
    let w = size[0];
    let len = size[1];
    context.setAttribute(tailEndNode, "len", len);
    context.setAttribute(tailEndNode, "type", objModel.strokeTailType);
    context.setAttribute(tailEndNode, "w", w);
  }

  context.appendNonEmptyChildNode(xmlNode, strokeChildNode);
}

function processShapeProperties(context: ToOOXMLConverter, objModelParent: any, xmlNodeParent: PartialElement, copyCheck=defaultCopyCheck, fillPropName?: string): void {
  let xmlShapePrNode = context.createNode("c:spPr");
  processFill(context, objModelParent, xmlShapePrNode, fillPropName, copyCheck);
  processStroke(context, objModelParent, xmlShapePrNode, copyCheck);
  processEffectList(context, objModelParent, xmlShapePrNode, copyCheck);
  context.appendNonEmptyChildNode(xmlNodeParent, xmlShapePrNode);
}

function setChildValue(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, nodeValue: any): void {
  if (nodeValue !== undefined) {
    let xmlChildNode = context.createChildNodes(xmlNode, xpath);
    let xmlChildTextNode = nodeValue !== null ? context.createTextNode(nodeValue) : context.createTextNode("");
    context.appendChildNode(xmlChildNode, xmlChildTextNode);
  }
}

function setChildValAttribute(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any): void {
  setChildAttribute(context, xmlNode, xpath, "val", attrValue);
}

function setChildAttribute(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrName: string, attrValue: any): void {
  let xmlChildNode = context.createChildNodes(xmlNode, xpath);
  context.setAttribute(xmlChildNode, attrName, attrValue)
}

function setChildValAttrAsBooleanFlip(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any): void {
  setChildValAttrAsBoolean(context, xmlNode, xpath, attrValue, -1)
}

function setChildValAttrAsBoolean(context: ToOOXMLConverter, xmlNode: PartialElement, xpath: string, attrValue: any, direction: number=1): void {
  if (attrValue === true) {
    if (direction === 1)
      setChildAttribute(context, xmlNode, xpath, "val", "1")
    else
      setChildAttribute(context, xmlNode, xpath, "val", "0")
  } else {
    if (direction === 1)
      setChildAttribute(context, xmlNode, xpath, "val", "0")
    else
      setChildAttribute(context, xmlNode, xpath, "val", "1")
  }
}
