import { ConvertFromOptions } from './OOXMLTypes';

import { Visitor } from './fromOOXML/Visitor';
import { ExecutionContext } from './fromOOXML/ExecutionContext';

import { DefaultVisitor } from './fromOOXML/DefaultVisitor';

import { RelsVisitor } from './fromOOXML/visitors';
import { ChartSpaceVisitor } from './fromOOXML/visitors';
import { ChartVisitor } from './fromOOXML/visitors';
import { PlotAreaVisitor } from './fromOOXML/visitors';
import { ShapePropertiesVisitor } from './fromOOXML/visitors';
import { BarChartTypeVisitor } from './fromOOXML/visitors';
import { ChartTypeVisitor } from './fromOOXML/visitors';
import { DataLabelsVisitor } from './fromOOXML/visitors';
import { SeriesVisitor } from './fromOOXML/visitors';
import { DataPointVisitor } from './fromOOXML/visitors';
import { MarkerVisitor } from './fromOOXML/visitors';
import { AxisVisitor } from './fromOOXML/visitors';
import { TextPropertiesVisitor } from './fromOOXML/visitors';
import { LegendEntryVisitor } from './fromOOXML/visitors';
import { LegendVisitor } from './fromOOXML/visitors';
import { NegativeShapeVisitor } from './fromOOXML/visitors';
import { TitleVisitor } from './fromOOXML/visitors';
import { LayoutVisitor } from './fromOOXML/visitors';

import { ThemeVisitor } from './fromOOXML/visitors';
import { ClrSchemeVisitor } from './fromOOXML/visitors';
import { FontSchemeVisitor } from './fromOOXML/visitors';
import { HyperlinkVisitor } from './fromOOXML/visitors';
import { AutoFilterVisitor } from './fromOOXML/visitors';
import { SortStateVisitor } from './fromOOXML/visitors';

import { SheetStylesVisitor } from './fromOOXML/visitors';
import { WorkbookVisitor } from './fromOOXML/visitors';
import { TableVisitor } from './fromOOXML/visitors';
import { DrawingVisitor} from './fromOOXML/visitors';
import { DrawingAnchorVisitor } from './fromOOXML/visitors';
import { DrawingGraphicFrameVisitor } from './fromOOXML/visitors';
import { DrawingSpVisitor } from './fromOOXML/visitors';
import { DrawingPicVisitor } from './fromOOXML/visitors';
import { DrawingGrpSpVisitor } from './fromOOXML/visitors';
import { DrawingCxnSpVisitor } from './fromOOXML/visitors';

import { RichValueStructureVisitor } from './fromOOXML/visitors';
import { RichValueDataVisitor } from './fromOOXML/visitors';
import { CommentsVisitor } from './fromOOXML/visitors';
import { CommentVisitor } from './fromOOXML/visitors';
import { ThreadedCommentsVisitor } from './fromOOXML/visitors';
import { ThreadedCommentVisitor } from './fromOOXML/visitors';
import { PersonListVisitor } from './fromOOXML/visitors';

// import { ChartAreaVisitor } from './fromOOXML/visitors/ChartAreaVisitor';


const _EmptyConvertFromOptions: ConvertFromOptions = {}

class PathVisitor {
  path: string;
  visitor: Visitor;
  constructor(path: string, visitor: Visitor) {
    this.path = path;
    this.visitor = visitor;
  }
}

interface VisitedRecord {
  visitor: Visitor;
  context: ExecutionContext;
  elemParent: Element;
  jsonParent: any/*JSON*/;
}
export class FromOOXMLConverter {
  private visitorsByXmlTagName:Map<String, Visitor> = new Map();
  private scopedVisitorsByXmlTagName:Map<String, Array<PathVisitor>> = new Map();
  private visitorParamsState:Map<string, any> = null;

  constructor() {
    this.registerVisitor("Relationships", new RelsVisitor());
    this.registerVisitor("spPr", new ShapePropertiesVisitor());
    this.registerVisitor("txBody", new TextPropertiesVisitor());
    this.registerVisitor("txPr", new TextPropertiesVisitor());

    this.registerVisitor("c:chartSpace", new ChartSpaceVisitor());
    // we only want to part the chart tag in the chartSpace, The chart tag in the graphicFrame is manually processed.
    this.registerVisitor("c:chartSpace", new ChartVisitor(), "chart");

    this.registerVisitor("c:plotArea", new PlotAreaVisitor());

    //TODO: add visitors for other chart types
    this.registerVisitor("c:barChart", new BarChartTypeVisitor());
    this.registerVisitor("c:doughnutChart", new ChartTypeVisitor());
    this.registerVisitor("c:lineChart", new ChartTypeVisitor());
    this.registerVisitor("c:ofPieType", new ChartTypeVisitor());
    this.registerVisitor("c:pieChart", new ChartTypeVisitor());
    this.registerVisitor("c:scatterChart", new ChartTypeVisitor());

    this.registerVisitor("c:barChart", new DataLabelsVisitor("dataLabels"), "dLbls");
    this.registerVisitor("c:doughnutChart", new DataLabelsVisitor("dataLabels"), "dLbls");
    this.registerVisitor("c:lineChart", new DataLabelsVisitor("dataLabels"), "dLbls");
    this.registerVisitor("c:ofPieType", new DataLabelsVisitor("dataLabels"), "dLbls");
    this.registerVisitor("c:pieChart", new DataLabelsVisitor("dataLabels"), "dLbls");
    this.registerVisitor("c:scatterChart", new DataLabelsVisitor("dataLabels"), "dLbls");

    this.registerVisitor("c:ser", new SeriesVisitor());
    this.registerVisitor("c:dPt", new DataPointVisitor());

    this.registerVisitor("c:marker", new MarkerVisitor());
    this.registerVisitor("c:catAx", new AxisVisitor());
    this.registerVisitor("c:valAx", new AxisVisitor());
    this.registerVisitor("c:dateAx", new AxisVisitor());
    this.registerVisitor("c:majorGridlines", new DefaultVisitor("gridLinesMajor"));
    this.registerVisitor("c:minorGridlines", new DefaultVisitor("gridLinesMinor"));

    // TODO - This should be allow but probably not required
    // this.registerVisitor("a:defRPr", new DefRPrVisitor());

    // ignore the top level txPr (for now)
    this.registerVisitor("c:chartSpace", null, "txPr");


    this.registerVisitor("c:catAx", new TextPropertiesVisitor("labels.text"), "txPr");
    this.registerVisitor("c:valAx", new TextPropertiesVisitor("labels.text"), "txPr");
    this.registerVisitor("c:dateAx", new TextPropertiesVisitor("labels.text"), "txPr");

    this.registerVisitor("c:legend", new LegendVisitor());
    this.registerVisitor("c:legend", new TextPropertiesVisitor("labels.text"), "txPr");
    this.registerVisitor("c:legendEntry", new LegendEntryVisitor());

    this.registerVisitor("c:ser", new NegativeShapeVisitor(), "extLst/ext/invertSolidFillFmt/spPr");
    this.registerVisitor("c:ser", new DataLabelsVisitor("labels"), "dLbls");

    this.registerVisitor("c:dLbl", new DataLabelsVisitor("points"));
    this.registerVisitor("c:title", new TitleVisitor());
    this.registerVisitor("c:title", null, "tx/rich");
    this.registerVisitor("c:title", null, "txPr");
//     this.registerVisitor("c:tx", new ChartTextVisitor());

    this.registerVisitor("c:layout", new LayoutVisitor());

    this.registerVisitor("c:dispUnits", new DefaultVisitor("dispUnits"));
    this.registerVisitor("c:dispUnitsLbl", new TitleVisitor("displayUnitsLabel"));
    this.registerVisitor("c:dispUnitsLbl", new TextPropertiesVisitor(), "tx/rich");

    this.registerVisitor("a:theme", new ThemeVisitor());
    this.registerVisitor("a:theme", new ClrSchemeVisitor(), "themeElements/clrScheme");
    this.registerVisitor("a:theme", new FontSchemeVisitor(), "themeElements/fontScheme");

    this.registerVisitor("autoFilter", new AutoFilterVisitor());
    this.registerVisitor("sortState", new SortStateVisitor());

    this.registerVisitor("s:workbook", new WorkbookVisitor());

    // No namespace (not known)
    this.registerVisitor("styleSheet", new SheetStylesVisitor());
    // this.registerVisitor("worksheet", new WorksheetVisitor());
    // this.registerVisitor("sheetData", new SheetDataVisitor());

    this.registerVisitor("table", new TableVisitor());
    this.registerVisitor("hlinkClick", new HyperlinkVisitor());

    // xdr namespace, not longer needed
    this.registerVisitor("wsDr", new DrawingVisitor());
    this.registerVisitor("twoCellAnchor", new DrawingAnchorVisitor());
    this.registerVisitor("oneCellAnchor", new DrawingAnchorVisitor());
    this.registerVisitor("absoluteAnchor", new DrawingAnchorVisitor());

    this.registerVisitor("graphicFrame", new DrawingGraphicFrameVisitor());
    this.registerVisitor("sp", new DrawingSpVisitor());
    this.registerVisitor("grpSp", new DrawingGrpSpVisitor());
    this.registerVisitor("cxnSp", new DrawingCxnSpVisitor());
    this.registerVisitor("pic", new DrawingPicVisitor());

    this.registerVisitor("rvStructures", new RichValueStructureVisitor());
    this.registerVisitor("rvData", new RichValueDataVisitor());

    this.registerVisitor("comments", new CommentsVisitor());
    this.registerVisitor("commentList", new CommentVisitor(), "comment");
    // why am I not using Text Properties Visitor?
    // this.registerVisitor("comment", new SheetTextPropertiesVisitor(), "text");
    this.registerVisitor("comment", new TextPropertiesVisitor("content"), "text");

    this.registerVisitor("ThreadedComments", new ThreadedCommentsVisitor()); // capitalized
    this.registerVisitor("threadedComment", new ThreadedCommentVisitor());
    this.registerVisitor("threadedComment", new TextPropertiesVisitor("content"), "text");

    this.registerVisitor("personList", new PersonListVisitor());
    //this.registerVisitor("c:dateAx", new TextPropertiesVisitor("labels.text"), "txPr");
  }

  registerVisitor(nodeType: string, visitor: Visitor, path: string=null): void {
    if (nodeType.indexOf(':') === -1) {
      nodeType = '*:' + nodeType;
    }
    const nodeTypeParts = nodeType.split(":");
    const localNodeType = nodeTypeParts.length > 1 ? nodeTypeParts[1] : nodeTypeParts[0];
    // const nameSpace = nodeTypeParts.length > 1 ? nodeTypeParts[0] : "x"; // not known

    if (!path) {
      this.visitorsByXmlTagName.set(localNodeType, visitor);
      // if (nameSpace) {
        this.visitorsByXmlTagName.set(nodeType, visitor);
      // }
      return;
    }

    let visitors:Array<PathVisitor> = this.scopedVisitorsByXmlTagName.get(localNodeType);
    if (!visitors) {
      visitors = [];
      this.scopedVisitorsByXmlTagName.set(localNodeType, visitors);
      // if (nameSpace) {
        this.scopedVisitorsByXmlTagName.set(nodeType, visitors);
      // }
    }

    visitors.push(new PathVisitor(path, visitor));

    // parse into tag & xPaths (relative paths)
    // Each context will have to track it's current path
    // Each context will have to track all visited paths (absolute)
  }

  getVisitorParamsState(): Map<string, any> {
    return this.visitorParamsState;
  }

  convert(xmlRootDoc: Document, location: string, options: ConvertFromOptions=_EmptyConvertFromOptions): any/*JSON*/ {
    // initialize the execution context
    const rootElement = xmlRootDoc.documentElement;
    if (!this.visitorParamsState || options?.paramMap) {
      this.visitorParamsState = options?.paramMap ?? new Map();
    }

    const jsonRoot: any/*JSON*/ = {};
    let rootVisitor: Visitor = this.visitorsByXmlTagName.get(rootElement.nodeName);
    if (!rootVisitor) {
      rootVisitor = this.visitorsByXmlTagName.get(rootElement.localName);
    }
    if (!rootVisitor) {
      throw new Error(`A visitor for the root element: '${rootElement.nodeName}' or '${rootElement.localName}' must be registered.`);
    }
    const rootPath: string = "/" + rootElement.localName;

    const context: ExecutionContext = new ExecutionContext(null/*parent*/, this, rootPath, rootElement, jsonRoot, location, options);
    const visited:VisitedRecord[] = [];
    this._doWalk(rootVisitor, context, visited, rootElement, jsonRoot, location, options);
    for (let i=0; i<visited.length; i++) {
      const visitedRecord:VisitedRecord = visited[i];
      try {
        visitedRecord.visitor?.afterVisit?.(visitedRecord.context, visitedRecord.elemParent, visitedRecord.jsonParent);
      } catch (error: any) {
        console.warn(`Error in afterVisit: ${visitedRecord.context.getPath()}`, error);
      }
    }
    return jsonRoot;
  }

  protected _walkScoped(elemName: string, context: ExecutionContext, visited: VisitedRecord[], elemParent: Element,
    jsonParent: any/*JSON*/,
    location: string,
    options: ConvertFromOptions
  ): void {
    const visitors: Array<PathVisitor> = this.scopedVisitorsByXmlTagName.get(elemName);
    for (let j=0; visitors && j<visitors.length; j++) {
      const visitorScoped: PathVisitor = visitors[j];
      let elementScoped: Element|NodeList = null;
      try {
        elementScoped = context.evaluate(visitorScoped.path, elemParent) as Element;
      } catch (error: any) {
        console.warn(`"Invalid path '${visitorScoped.path}' for '${elemName}'.`);
      }
      if (!elementScoped)
        continue;

      const walkElement = (element: Element) => {
        let currentPath: string = element.localName;
        let nodeIter:Element = element.parentNode as Element;

        while (nodeIter && nodeIter !== elemParent) {
          currentPath = nodeIter.localName + "/" + currentPath;
          nodeIter = nodeIter.parentNode as Element;
        }
        const scopedPath: string = context.getPath() + "/" + currentPath;
        if (visitorScoped.visitor) {
          const subExecutionContext: ExecutionContext =
              new ExecutionContext(context, this, scopedPath, context.getElemRoot(), context.getJsonRoot(), location, options);
          this._doWalk(visitorScoped.visitor, subExecutionContext, visited, element/*elemParent*/, jsonParent, location, options);
        }
      }
      if ((elementScoped as NodeList).length > 0) {
        const asNodeList = elementScoped as NodeList;
        for (let i=0; i<asNodeList.length; i++) {
           walkElement(asNodeList.item(i) as Element);
        }
      } else {
        walkElement(elementScoped as Element);
      }
    }
  }

  protected _doWalk(visitor: Visitor, context: ExecutionContext, visited: VisitedRecord[], elemParent: Element, jsonParent: any/*JSON*/,
    location: string, options: ConvertFromOptions
  ): any/*JSON*/ {
    let jsonVisitResult: any/*JSON*/ = null;
    if (visitor) {
      // record for after visit
      visited.push({visitor, context, elemParent, jsonParent});
      jsonVisitResult = visitor.visit(context, elemParent, jsonParent);
    }
    if (!jsonVisitResult) {
      jsonVisitResult = jsonParent;
    }
    // }
      // Walk the scoped items
    const elemName: string = elemParent.localName;
    this._walkScoped(elemName, context, visited, elemParent, jsonVisitResult, location, options);

    // Walk the children
    const childNodes: NodeList = elemParent.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const childNode:Node = childNodes.item(i);
      //nodes that are not elements are handled in the above visit method call
      if (childNode.nodeType === 1) { // Node.ELEMENT_NODE) {
        const childElement: Element = childNode as Element;
        const childElementName: string = childElement.localName;
        const subVisitor: Visitor = this.visitorsByXmlTagName.get(childElementName);
        const childPath: string = context.getPath() + "/" + childElementName;
        const subExecutionContext:ExecutionContext =
          new ExecutionContext(context, this, childPath, context.getElemRoot(), context.getJsonRoot(), location, options);
        // if (subVisitor) {
          this._doWalk(subVisitor, subExecutionContext, visited, childElement/*elemParent*/, jsonVisitResult ?? jsonParent/*jsonParent*/, location, options);
        // } else {
        //   this.doWalk(null, subExecutionContext, childElement/*elemParent*/, jsonVisitResult ?? jsonParent/*jsonParent*/);
        // }
        // this._walkScoped(childElementName, context, visited, childElement, jsonVisitResult ?? jsonParent/*jsonParent*/, location, options);
      }
    }

    // visitor?.afterVisit?.(context, elemParent, jsonVisitResult ?? jsonParent/*jsonParent*/);
    return jsonVisitResult;
  }
}

export default FromOOXMLConverter;