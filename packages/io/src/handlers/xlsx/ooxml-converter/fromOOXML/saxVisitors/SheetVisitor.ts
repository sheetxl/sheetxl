import {
  CoordUtils, ISheet, ISheetView, ICell, Tuple, AddressUtils, IRange,
  ITypes, FormulaError, Scalar, ScalarType, ITable, IRangeSelection,
  IStyle, IHyperlink, ICellHeader, IAutoFilter, IAutoSort, ISort,
  ISheetProtection, IProtection, IConditionalFormat, CellCoords, RangedValue
  //RangeProtection,
} from '@sheetxl/sdk';

import { SaxVisitHandler, SAXExecutionContext, CopyMutators, SaxParser } from '../../../../../sax';
import * as UtilsOOXML from '../../UtilsOOXML';
import * as NumberUtils from '../NumberUtils';


  // ? styles

  // cellWatches (needed for persisting scripts?)
  // smartTags

  // dataValidations
  // dataConsolidate

  // legacyDrawing (this is shapes?)
  // picture ? - background?

  // controls
  // scenarios

  // dimension - Why do we care

  // pageMargins
  // pageSetup
  // printOptions
  // phoneticPr
  // headerFoot

  // AlternateContent / controls

  // TODO - Error Handling - Pass an option that says that if values are written out of order instead of stopping it will skip out of orders and throw PartialError at end. (with a report?) (we could also add them all to a list, sort and then insert)

export const createSheetSaxVisitor = (
  sheet: ISheet.JSON,
  getRef: (relId: string, asBinary?: boolean) => any, // TODO - this should be a context like DOM.
  addSharedString: (str: string) => number,
  mapDxfs?: Map<number, any>,
  onEnd?: () => void,
  onWarning?: (message: string) => void,
  onProgress?: (amount: number, total?: number) => void,
  paramMap?: Map<string, any>
): SaxParser.EventHandler => {
  const delegate = new SaxVisitHandler()

  const tupleBuilder:Tuple.IBuilder<ICell.JSON> = new Tuple.TransposedBuilder();

  // let customViews:ISheetView.JSON[] = [];
  let activeView:ISheetView.JSON = null;

  delegate.registerVisitor<IAutoFilter.JSON, ISheet.JSON> ({
    from: "autoFilter",
    to: "filter",
    openTag: (context: SAXExecutionContext<IAutoFilter.JSON>) => {
      context.copyTo("ref", CopyMutators.Default);
    }
  });

  delegate.registerVisitor<IConditionalFormat.JSON, ISheet.JSON> ({
    from: "conditionalFormatting",
    to: {},//"conditionals",
    openTag: (context: SAXExecutionContext<IConditionalFormat.JSON>) => {
      const parent:any = context.getParent<any>();
      if (!parent.conditionals) {
        parent.conditionals = [];
      }
      parent.conditionals.push(context.getSource());

      const attrSqref = context.getAttribute("sqref");
      if (attrSqref) {
        const conditional:IConditionalFormat.JSON = context.getSource();
        conditional.ref = attrSqref.split(" ").join(",");
      }
      context.copyTo("pivot", CopyMutators.Boolean);
    },
    closeTag: (context: SAXExecutionContext<IConditionalFormat.JSON>) => {
      const source = context.getSource();
      if ((source as any).rule) {
        const keys = Object.keys((source as any).rule);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (key === 'rule') continue; // except for the rule
          source[key] = (source as any).rule[key];
        }
      }
      delete (source as any).rule;
    }
  });

  delegate.registerVisitor<any, IConditionalFormat.JSON> ({
    from: "cfRule",
    to: "rule",
    openTag: (context: SAXExecutionContext<IConditionalFormat.JSON>) => {
      const parent:IConditionalFormat.JSON = context.getParent<IConditionalFormat.JSON>();

      context.copyToObject<IConditionalFormat.JSON>(parent, "type", CopyMutators.Default);
      context.copyToObject<IConditionalFormat.JSON>(parent, "priority", CopyMutators.Integer);
      context.copyToObject<IConditionalFormat.JSON>(parent, "stopIfTrue", CopyMutators.Boolean);

      const dxfId = context.getAttribute<number>("dxfId", CopyMutators.Integer);
      if (dxfId !== null) {
        let dxf:IStyle.JSON = mapDxfs?.get(dxfId);
        if (!dxf) {
          onWarning?.(`Unable to load conditional color. Invalid dxfI: '${dxfId}' at '${context.getPath()}'.`);
          dxf = {};
        }
        parent.style = dxf;
      }

      // aboveAverage
      context.copyToObject<IConditionalFormat.JSON>(parent, "aboveAverage", CopyMutators.Boolean);
      context.copyToObject<IConditionalFormat.JSON>(parent, "equalAverage", CopyMutators.Boolean);
      context.copyToObject<IConditionalFormat.JSON>(parent, "stdDev", CopyMutators.Integer);

      // top10
      context.copyToObject<IConditionalFormat.JSON>(parent, "bottom", CopyMutators.Boolean);
      context.copyToObject<IConditionalFormat.JSON>(parent, "percent", CopyMutators.Boolean);
      context.copyToObject<IConditionalFormat.JSON>(parent, "rank", CopyMutators.Integer);

      // cellIs
      context.copyToObject<IConditionalFormat.JSON>(parent, "operator", CopyMutators.Default);

      // containsText
      context.copyToObject<IConditionalFormat.JSON>(parent, "text", CopyMutators.Default);

      // timePeriod
      context.copyToObject<IConditionalFormat.JSON>(parent, "timePeriod", CopyMutators.Default);
    }
  });

  delegate.registerVisitor<IConditionalFormat.ColorScale, IConditionalFormat.JSON> ({
    from: "colorScale",
    to: "colorScale",
    // openTag: (context: SAXExecutionContext<IConditionalFormat.ColorScale>) => {
    //   // const _parent:IConditionalFormat.JSON = context.getParent<IConditionalFormat.JSON>();
    // }
  });

  delegate.registerVisitor<IConditionalFormat.DataBar, IConditionalFormat.JSON> ({
    from: "dataBar",
    to: "dataBar",
    openTag: (context: SAXExecutionContext<IConditionalFormat.DataBar>) => {
      context.copyTo("maxLength", CopyMutators.Integer);
      context.copyTo("minLength", CopyMutators.Integer);
      context.copyTo("showValue", CopyMutators.Boolean);
    }
  });

  delegate.registerVisitor<IConditionalFormat.IconSet, IConditionalFormat.JSON> ({
    from: "iconSet",
    to: "iconSet",
    openTag: (context: SAXExecutionContext<IConditionalFormat.IconSet>) => {
      context.copyTo("iconSet", CopyMutators.Default);
      context.copyTo("reverse", CopyMutators.Boolean);
      context.copyTo("showValue", CopyMutators.Boolean);
      // context.copyTo("percent", CopyMutators.Boolean); // this is on the conditions? OOXML defines it but it doesn't seem to be used?
    }
  });

  // conditional formula
  delegate.registerVisitor<string, IConditionalFormat.JSON> ({
    from: "formula",
    to: null,//"formula",
    text: (text: string, context: SAXExecutionContext<string>): void => {
      const parent:IConditionalFormat.JSON = context.getParent();
      let formulas:string[] = parent.formulas;
      if (!formulas) {
        formulas = [];
        parent.formulas = formulas;
      }
      formulas.push(text);
    }
  });

  delegate.registerVisitor<IConditionalFormat.Condition, any> ({
    from: "cfvo",
    to: {},
    openTag: (context: SAXExecutionContext<any>) => {
      const parent:any = context.getParent<any>();
      if (!parent.conditions) {
        parent.conditions = [];
      }
      parent.conditions.push(context.getSource());

      context.copyTo("type", CopyMutators.Default);
      context.copyTo("value", CopyMutators.Float, "val");
      context.copyTo("gte", CopyMutators.Boolean);
    }
  });

  delegate.registerVisitor<IConditionalFormat.Condition, any> ({
    from: "color",
    to: {},
    openTag: (context: SAXExecutionContext<any>) => {
      const parent:any = context.getParent<any>();
      if (!parent.colors) {
        parent.colors = [];
      }
      // const source = context.getSource();
      const strColor = UtilsOOXML.processDataBarColor(
        (name: string): string => {
          return context.getAttribute(name);
        },
        //auto
      )
      parent.colors.push(strColor);
    }
  });

  delegate.registerVisitor<IAutoFilter.IndexedField, IAutoFilter.JSON> ({
    from: "filterColumn",
    to: "filterColumn",
    openTag: (context: SAXExecutionContext<IAutoFilter.IndexedField>) => {
      const parent:IAutoFilter.JSON = context.getParent<IAutoFilter.JSON>();
      if (!parent.fields) {
        parent.fields = [];
      }
      parent.fields.push(context.getSource());
      context.copyTo("offset", CopyMutators.Integer, "colId");
      context.copyTo("hiddenButton", CopyMutators.Boolean);
      context.copyTo("showButton", CopyMutators.Boolean);
    }
  });

  delegate.registerVisitor<IAutoFilter.ColorCriterian, IAutoFilter.IndexedField> ({
    from: "colorFilter",
    to: "colorFilter",
    openTag: (context: SAXExecutionContext<IAutoFilter.ColorCriterian>) => {

      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Color;
      context.copyTo("cellColor", CopyMutators.Boolean);
      context.copyTo("styleId", CopyMutators.Integer, "dxfId");
    }
  });

  delegate.registerVisitor<IAutoFilter.DynamicCriterian, IAutoFilter.IndexedField> ({
    from: "dynamicFilter",
    to: "dynamicFilter",
    openTag: (context: SAXExecutionContext<IAutoFilter.DynamicCriterian>) => {

      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Dynamic;
      context.copyTo("dynamicType", CopyMutators.Default, "type");
      context.copyTo("val", CopyMutators.Float);
      context.copyTo("maxVal", CopyMutators.Float, "maxVal");
    }
  });

  delegate.registerVisitor<IAutoFilter.IconCriterian, IAutoFilter.IndexedField> ({
    from: "iconFilter",
    to: "iconFilter",
    openTag: (context: SAXExecutionContext<IAutoFilter.IconCriterian>) => {
      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Icon;
      context.copyTo("iconId", CopyMutators.Integer);
      context.copyTo("iconSet", CopyMutators.Default);
    }
  });

  delegate.registerVisitor<IAutoFilter.Top10Criterian, IAutoFilter.IndexedField> ({
    from: "top10",
    to: "top10",
    openTag: (context: SAXExecutionContext<IAutoFilter.Top10Criterian>) => {

      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Top10;
      context.copyTo("filterVal", CopyMutators.Float);
      context.copyTo("percent", CopyMutators.Boolean);
      context.copyTo("top", CopyMutators.Boolean);
      context.copyTo("val", CopyMutators.Float);
    }
  });

  delegate.registerVisitor<IAutoFilter.FilterItemCriterian, IAutoFilter.JSON> ({
    from: "filters",
    to: "filters",
    openTag: (context: SAXExecutionContext<IAutoFilter.FilterItemCriterian>) => {

      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Items;
      context.copyTo("blank", CopyMutators.Boolean);
      context.copyTo("calendarType", CopyMutators.Default);
    }
  });

  delegate.registerVisitor<IAutoFilter.DateGroupItem, IAutoFilter.FilterItemCriterian> ({
    from: "dateGroupItem",
    to: "dateGroupItem",
    openTag: (context: SAXExecutionContext<IAutoFilter.DateGroupItem>) => {

      const parent:IAutoFilter.FilterItemCriterian = context.getParent<IAutoFilter.FilterItemCriterian>();
      if (!parent.dateGroups) {
        parent.dateGroups = [];
      }
      parent.dateGroups.push(context.getSource());
      context.copyTo("group", CopyMutators.Default, "dateTimeGrouping");
      context.copyTo("day", CopyMutators.Integer);
      context.copyTo("hour", CopyMutators.Integer);
      context.copyTo("minute", CopyMutators.Integer);
      context.copyTo("month", CopyMutators.Integer);
      context.copyTo("second", CopyMutators.Integer);
      context.copyTo("year", CopyMutators.Integer);
    }
  });

  delegate.registerVisitor<Scalar, IAutoFilter.FilterItemCriterian> ({
    from: "filter",
    to: "filter",
    openTag: (context: SAXExecutionContext<Scalar>) => {
      const parent:IAutoFilter.FilterItemCriterian = context.getParent<IAutoFilter.FilterItemCriterian>();
      if (!parent.items) {
        parent.items = [];
      }
      parent.items.push(context.getAttribute('val', CopyMutators.Float));
    }
  });

  delegate.registerVisitor<IAutoFilter.CustomCriterian, IAutoFilter.JSON> ({
    from: "customFilters",
    to: "customFilters",
    openTag: (context: SAXExecutionContext<IAutoFilter.CustomCriterian>) => {
      const parent:IAutoFilter.IndexedField = context.getParent<IAutoFilter.IndexedField>();
      if (!parent.criteria) {
        parent.criteria = [];
      }
      parent.criteria.push(context.getSource());
      context.getSource().type = IAutoFilter.Type.Custom;
      context.copyTo("and", CopyMutators.Boolean);
    }
  });

  delegate.registerVisitor<IAutoFilter.CustomFilter, IAutoFilter.CustomCriterian> ({
    from: "customFilter",
    to: "customFilter",
    openTag: (context: SAXExecutionContext<IAutoFilter.CustomFilter>) => {
      const parent:IAutoFilter.CustomCriterian = context.getParent<IAutoFilter.CustomCriterian>();
      if (!parent.filters) {
        parent.filters = [];
      }
      parent.filters.push(context.getSource());
      context.copyTo("operator", CopyMutators.Default);
      context.copyTo("value", CopyMutators.Float, "val");
    }
  });

  delegate.registerVisitor<IAutoSort.JSON, IAutoFilter.JSON> ({
    from: "sortState",
    to: "sort",
    openTag: (context: SAXExecutionContext<IAutoSort.JSON>) => {
      context.copyTo("ref", CopyMutators.Default);
    }
  });

  delegate.registerVisitor<ISort.Field, IAutoSort.JSON> ({
    from: "sortCondition",
    to: "sortCondition",
    openTag: (context: SAXExecutionContext<ISort.Field>) => {
      // context.copyTo("ref", CopyMutators.Default);
      const parent:IAutoSort.JSON = context.getParent<IAutoSort.JSON>();
      if (!parent.fields) {
        parent.fields = [];
      }
      const field = context.getSource();
      parent.fields.push(field);
      context.copyTo("sortOn", CopyMutators.Default, "sortBy");
      /* when sortby == cellColor or fontColor */
      // TODO - this is a style offset id. pass the mappings
      // note - this is interesting as we don't record the dxfId. Should we denormalize the record like excel? Not too hard.
      context.copyTo("dxfId", CopyMutators.Default, "sortBy");
      /* when sortBy == icon */
      context.copyTo("iconSet", CopyMutators.Default);
      context.copyTo("customList", CopyMutators.Default);

      const refString = context.getAttribute("ref");
      if (refString) {
        const ref:IRange.Coords = AddressUtils.fastStringToRange(refString, _reuseRefRange);
        const refColStart = ref.colStart;
        const parentRef:IRange.Coords = AddressUtils.fastStringToRange(parent.ref, _reuseRefRange);
        const parentRefColStart = parentRef.colStart;
        field.offset = parentRef ? (refColStart - parentRefColStart) : refColStart;
      }
      field.reverse = context.getAttribute<boolean>("descending", CopyMutators.Boolean) ?? false;
    }
  });

  delegate.registerVisitor<IAutoSort.JSON, IAutoFilter.JSON> ({
    from: "AlternateContent",
    to: null, // ignore TODO - pass to dom parser
    // openTag: (context: SAXExecutionContext<IAutoSort.JSON>) => {
    // },
    // closeTag: (context: SAXExecutionContext<IAutoSort.JSON>) => {
    // }
  });

  const copySheetView = (context: SAXExecutionContext<ISheetView.JSON>) => {
    activeView = context.getSource();
    context.copyTo("topLeft", CopyMutators.Default, "topLeftCell");

    const defaultGridColor = NumberUtils.parseAsBoolean(context.getAttribute("defaultGridColor"));
    const colorId = context.getAttribute("colorId");
    if (colorId !== null && !defaultGridColor) {
      context.getSource().gridLineColor = 'index' + (parseFloat(colorId));
    }
    context.copyTo("showZeros", CopyMutators.Boolean);
    context.copyTo("showFormulas", CopyMutators.Boolean);
    context.copyTo("zoomScale", CopyMutators.Integer);
    // Excel has only a single flag
    context.copyTo("showRowHeaders", CopyMutators.Boolean, "showRowColHeaders");
    context.copyTo("showColumnHeaders", CopyMutators.Boolean, "showRowColHeaders");
    // Excel has only a single flag
    context.copyTo("showRowGridlines", CopyMutators.Boolean, "showGridLines");
    context.copyTo("showColumnGridlines", CopyMutators.Boolean, "showGridLines");

    // showWhiteSpace
    // showOutlineSymbols?: boolean;
    // showRuler?: boolean;
    // rightToLeft?: boolean;
    // showAutoFilter // Flag indicating whether the autoFilter dropdown buttons are visible in this custom view.
    // showPageBreaks
  }

  delegate.registerVisitor<ISheetView.JSON, ISheet.JSON> ({
    from: "sheetView",
    to: "view",
    openTag: (context: SAXExecutionContext<ISheetView.JSON>) => {
      copySheetView(context)
    },
    closeTag: () => {
      activeView = null;
    }
  });

  delegate.registerVisitor({
    from: "customSheetViews",
    to: "customSheetViews",
    openTag: (context: SAXExecutionContext<[]>) => {
      context.setSource([]);
      // TODO - should use the view
    }
  });

  delegate.registerVisitor<ISheetView.JSON, ISheet.JSON> ({
    from: "customSheetView",
    to: [],
    openTag: (context: SAXExecutionContext<ISheetView.JSON>) => {
      copySheetView(context);
    },
    closeTag: () => {
      activeView = null;
    }
  });

  delegate.registerVisitor({
    from: "selection",
    to: "selection",
    openTag: (context: SAXExecutionContext<IRangeSelection.Coords>) => {
      if (!activeView)
        return;
      context.copyTo("cell", CopyMutators.Default, "activeCell");
      context.copyTo("rangeIndex", CopyMutators.Integer, "activeCellId");

      const attrActiveCell = context.getAttribute("activeCell");
      const attrSqref = context.getAttribute("sqref");
      if (attrSqref && attrSqref !== attrActiveCell) {
        const selection:any = context.getSource();
        selection.ranges = attrSqref.split(" ");
      }
    }
  });

  delegate.registerVisitor({
    from: "pane",
    to: "pane",
    openTag: (context: SAXExecutionContext<any>) => {
      if (!activeView)
        return;
      const attrState = context.getAttribute("state");
      if (attrState === 'frozen') {
        const freezePanes:any = {}; // ResolvableProperties<ISheetView.FreezePanes>
        activeView.freezePanes = freezePanes;
        context.copyToObject(freezePanes, "topLeft", CopyMutators.Default, "topLeftCell");
        const topLeft = activeView.topLeft ? AddressUtils.fastStringToCell(activeView.topLeft as string) : {
          colIndex: 0,
          rowIndex: 0
        }

        // Our rows and columns are absolute but Excels are relative to topLeft
        const splitCoords:CellCoords = {
          colIndex: 0,
          rowIndex: 0
        };
        context.copyToObject(splitCoords, "colIndex", CopyMutators.Integer, "xSplit");
        context.copyToObject(splitCoords, "rowIndex", CopyMutators.Integer, "ySplit");
        const freezeCoords = {
          colIndex: topLeft.colIndex + splitCoords.colIndex,
          rowIndex: topLeft.rowIndex + splitCoords.rowIndex
        }
        freezePanes.coords = AddressUtils.cellToString(freezeCoords);
      } else if (attrState === 'split' || attrState === 'frozenSplit') { // Move frozen split to frozen block?
        // nothing yet
      }
    }
  });

  delegate.registerVisitor({
    from: "tabColor", // sheetPr/tabColor
    to: null, // we manually set
    openTag: (context: SAXExecutionContext<string>) => {
      const strColor = UtilsOOXML.processDataBarColor(
        (name: string): string => {
          return context.getAttribute(name);
        },
        //auto
      )
      if (strColor) {
        sheet.tabColor = strColor;
      }
    }
  });

  delegate.registerVisitor({
    from: "pageSetUpPr", // sheetPr/pageSetUpPr
    to: "pageSetUpPr",
    openTag: (_context: SAXExecutionContext<any>) => {
      //autoPageBreak
      //fitToPage
    }
  });

  delegate.registerVisitor({
    from: "outlinePr", // sheetPr/outlinePr
    to: "outlinePr",
    openTag: (_context: SAXExecutionContext<any>) => {
      //applyStyles
      //showOutlineSymbols
      //summaryBelow
      //summaryRight
    }
  });

  delegate.registerVisitor({
    from: "pageMargins",
    to: "pageMargins",
    openTag: (_context: SAXExecutionContext<any>) => {
      //bottom
      //footer
      //header
      //left
      //right
      //top
    }
  });

  delegate.registerVisitor({
    from: "pageSetup",
    to: "pageSetup",
    openTag: (_context: SAXExecutionContext<any>) => {
      //blackAndWhite
      //cellComments
      //copies
      //draft
      //errors
      //firstPageNumber
      //fitToHeight
      //fitToWidth
      //horizontalDpi
      //id?
      //orientation
      //pageOrder
      //paperSize
      //scale
      //useFirstPageNumber
      //usePrinterDefaults
      //verticalDpi
    }
  });

  delegate.registerVisitor({
    from: "printOptions",
    to: "printOptions",
    openTag: (_context: SAXExecutionContext<any>) => {
      //gridLines
      //gridLinesSet
      //headings
      //horizontalCentered
      //verticalCentered
    }
  });

  // delegate.registerVisitor({
  //   from: "ignoredErrors",
  //   to: "ignoredErrors",
  //   openTag: (context: SAXExecutionContext<[]>) => {
  //     context.setSource([]);
  //   }
  // });

  // delegate.registerVisitor({
  //   from: "ignoredError",
  //   to: [],
  //   openTag: (context: SAXExecutionContext<string>) => {
  //     const ref:string = context.getAttribute("sqref");
  //     //numberStoredAsText
  //     context.setSource(ref);
  //   }
  // });

  delegate.registerVisitor<[], ISheet.JSON>({
    from: "mergeCells",
    to: "merges", // why is this not validating in typescript?
    openTag: (context: SAXExecutionContext<[]>) => {
      context.setSource([]);
    }
  });

  delegate.registerVisitor({
    from: "mergeCell",
    to: [],
    openTag: (context: SAXExecutionContext<string>) => {
      const ref:string = context.getAttribute("ref");
      context.setSource(ref);
    }
  });

  delegate.registerVisitor({
    from: "hyperlinks",
    to: "hyperlinks",
    openTag: (context: SAXExecutionContext<[]>) => {
      context.setSource([]);
    }
  });

  delegate.registerVisitor({
    from: "hyperlink",
    to: [],
    openTag: (context: SAXExecutionContext<{ r: IRange.Coords | string, v: IHyperlink.JSON | string }>) => {
      const rId:string = context.getAttribute("r:id");
      const ref:string = context.getAttribute("ref");
      if (!ref) {
        console.warn(`No ref found for hyperlink`);
        return;
      }
      context.setKey(ref)
      // The address is an external address or a reference to a sheet.
      let address:string = rId ? getRef(rId) : '';
      if (typeof address !== 'string') {
        console.warn(`Invalid address `, address);
        return;
      }

      // display. The OOXML scheme allows for the display to be here to override the string from the sheet. Excel doesn't appear to support this.
      const display = context.getAttribute("location");
      if (address.endsWith("\\")) {
        address = address.substring(0, address.length - 1);
      }
      const location = context.getAttribute("location");
      if (location) {
        if (display && display !== location) {
          console.warn('display and location are different', display, location);
        }
        // For internal locations this will create a leading '#' but this is what we want.
        address += '#' + location;
      }
      if (!address) {
        console.warn(`No address found for hyperlink. r:id`, rId);
        return;
      }

      let hyperlink:IHyperlink.JSON | string;
      const tooltip = context.getAttribute("tooltip");
      if (tooltip) {
        hyperlink = {
          address,
          tooltip
        }
      } else {
        hyperlink = address;
      }

      context.setSource({
        r: ref,
        v: hyperlink
      });
    }
  });

  delegate.registerVisitor({
    from: "drawing",
    to: "movables",
    openTag: (context: SAXExecutionContext<any>) => {
      const rId:string = context.getAttribute("r:id");
      if (!rId) return;
      const movables = getRef(rId);
      if (!movables) {
        console.warn('no drawing found for rId', rId);
        return;
      }
      context.setSource(movables.movables);
    }
  });

  delegate.registerVisitor({
    from: "tableParts",
    to: "tables",
    openTag: (context: SAXExecutionContext<[]>) => {
      context.setSource([]);
    }
  });

  delegate.registerVisitor({
    from: "tablePart",
    to: [],
    openTag: (context: SAXExecutionContext<ITable.JSON>) => {
      const rId:string = context.getAttribute("r:id");
      if (!rId) return;
      const table = getRef(rId);
      if (!table) {
        console.warn('no table found for rId', rId);
        return;
      }
      context.setSource(table);
    }
  });

  delegate.registerVisitor({
    from: "worksheet",
    to: "worksheet",
    openTag: (_context: SAXExecutionContext<any>) => {}
  });

  delegate.registerVisitor({
    from: "sheetProtection",
    to: "protection",
    openTag: (context: SAXExecutionContext<ISheetProtection.JSON>) => {
      // context.copyTo('sheet', existingMutator);
      let isProtected = false;
      if (context.hasAttribute("sheet") && CopyMutators.Boolean(context.getAttribute("sheet"))) {
        isProtected = true;
      }
      // Note - This is not quite right as this means that we can't import the 'default' flags.
      if (!isProtected) {
        context.setSource(undefined);
        return;
      }

      // For reasons I haven't work out SheetProtection attributes have different flags to indicate that a property is allowed
      const existingMutator = (value: any): boolean => {
        if (value === true || value === "1" || value === "on" || value === "true") return true;
        if (value === false || value === "0" || value === "off" || value === "false") return true;
        // if (value === false || value === "0" || value === "off" || value === "false") return false;
        return null;
      }
      context.copyTo('autoFilter', existingMutator);
      context.copyTo('deleteColumns', existingMutator);
      context.copyTo('formatCells', existingMutator);
      context.copyTo('formatColumns', existingMutator);
      context.copyTo('formatRows', existingMutator);
      context.copyTo('insertColumns', existingMutator);
      context.copyTo('insertHyperlinks', existingMutator);
      context.copyTo('insertRows', existingMutator);
      context.copyTo('objects', existingMutator);
      context.copyTo('pivotTables', existingMutator);
      context.copyTo('scenarios', existingMutator);
      context.copyTo('selectUnlockedCells', existingMutator);
      context.copyTo('selectUnlockedCells', existingMutator);

      context.copyTo('sort', existingMutator);

      const password:Partial<IProtection.EncryptedPassword> = {}
      context.copyToObject<IProtection.EncryptedPassword>(password, "hash", CopyMutators.Default, "hashValue");
      context.copyToObject<IProtection.EncryptedPassword>(password, "algorithm", CopyMutators.Default, "algorithmName");
      context.copyToObject<IProtection.EncryptedPassword>(password, "salt", CopyMutators.Default, "saltValue");
      context.copyToObject<IProtection.EncryptedPassword>(password, "spinCount", CopyMutators.Integer);

      if (Object.keys(password).length > 0) {
        const protection = context.getSource();
        protection.password = password;
      }
    }
  });

  delegate.registerVisitor({
    from: "protectedRanges",
    to: "protectedRanges",
    openTag: (context: SAXExecutionContext<{}>) => {
      context.setSource({});
    }
  });

  delegate.registerVisitor({
    from: "protectedRange",
    to: {},
    openTag: (context: SAXExecutionContext<any>) => { // ResolvableProperties<RangeProtection>
      const ref:string = context.getAttribute("sqref");
      context.setKey(ref);

      context.copyTo("name");
      // Example - "O:WDG:WDD:(A;;CC;;;AN)(A;;CC;;;S-1-5-17)(A;;CC;;;S-1-5-3)"
      context.copyTo("securityDescriptor");

      const password:Partial<IProtection.EncryptedPassword> = {}
      context.copyToObject<IProtection.EncryptedPassword>(password, "hash", CopyMutators.Default, "hashValue");
      context.copyToObject<IProtection.EncryptedPassword>(password, "algorithm", CopyMutators.Default, "algorithmName");
      context.copyToObject<IProtection.EncryptedPassword>(password, "salt", CopyMutators.Default, "saltValue");
      context.copyToObject<IProtection.EncryptedPassword>(password, "spinCount", CopyMutators.Integer);
      if (Object.keys(password).length > 0) {
        const protection = context.getSource();
        protection.password = password;
      }
    }
  });

  delegate.registerVisitor({
    from: "sheetFormatPr",
    to: "sheetFormatPr",
    openTag: (context: SAXExecutionContext<{}>) => {

      context.copyToObject<ISheet.JSON>(sheet, "defaultColSize", CopyMutators.Float, "defaultColWidth");
      context.copyToObject<ISheet.JSON>(sheet, "outlineLevelCol", CopyMutators.Integer, "outlineLevelCol");

      const aCustomHeight = context.getAttribute("customHeight");
      // If customHeight is set then we copy the defaultRowSize
      // Another approach is to copy as is and then ignore in models for non lossy rounding trip (but not sure why we would want to keep this)
      if (aCustomHeight === '1' || aCustomHeight === 'true') {
        context.copyToObject<ISheet.JSON>(sheet, "defaultRowSize", CopyMutators.Float, "defaultRowHeight");
      }
      context.copyToObject<ISheet.JSON>(sheet, "outlineLevelRow", CopyMutators.Integer, "outlineLevelRow");
      // baseColWidth - Test this overridden as we default this

      // This is a style item
      // context.copyFromAttribute(elem, "thickBottom", defaultRows, "thickBottom", CopyMutators.Boolean);
      // context.copyFromAttribute(elem, "thickTop", defaultRows, "thickTop", CopyMutators.Boolean);
      // zeroHeight
    }
  });

  delegate.registerVisitor({
    from: "cols",
    to: "cols",
    openTag: (context: SAXExecutionContext<ICellHeader.JSON[]>) => {
      context.setSource([]);
    }
  });

  delegate.registerVisitor({
    from: "col",
    to: [],
    openTag: (context: SAXExecutionContext<ICellHeader.JSON>) => {
      context.copyTo('min', (value) => parseInt(value) - 1);
      context.copyTo('max', (value) => parseInt(value) - 1);

      context.copyTo('sz', CopyMutators.Float, "width");
      context.copyTo('csz', CopyMutators.Boolean, "customWidth");
      context.copyTo('h', CopyMutators.Boolean, "hidden");
      context.copyTo('l', CopyMutators.Integer, "outlineLevel");

      context.copyTo('s', CopyMutators.Integer, "style");

      // context.copyTo('b', CopyMutators.Boolean, "bestFit");
      // context.copyTo('c', CopyMutators.Boolean, "collapsed");
      // context.copyTo('p', CopyMutators.Boolean, "phonetic");
    }
  });

  delegate.registerVisitor({
    from: "oleObjects",
    to: null, // ignore
    openTag: (context: SAXExecutionContext<any>) => {
      context.warn(`'OLE Objects' are not supported.`);
    }
  });

  let currentString:any[] = [];
  let currentText = null;
  // TODO - reuse this for the sharedString as well.
  const sharedStringHandler: SaxParser.EventHandler<number> = {
    onOpenTag: (tag: SaxParser.StartTag): void => {
      // console.log('sharedString:open', tag);
      currentString.push(tag);
      if (currentText === null) {
        currentText = '';
      }
    },
    onText: (text: string): void => {
      // console.log('sharedString:text', text);
      currentText += text;
    },
    onEnd: (): number => {
      const id:number = addSharedString(currentText);
      currentText = null;
      return id;
    },
    onError: (_error: any): void => {
    }
  }

  return createSheetDataSaxVisitor(
    tupleBuilder,
    sheet,
    delegate.createEventHandler(sheet, onEnd, onWarning),
    onWarning,
    onProgress,
    sharedStringHandler,
    paramMap
  );
}

export class RowAttributeType {
  // 1
  static Collapsed = 0b1;
  // 2
  static CustomFormat = 0b10;
  // 4
  static CustomHeight = 0b100;
  // 8
  static Hidden = 0b1000;
  // 16
  static Ht = 0b10000;
  // 32
  static OutlineLevel = 0b100000;
  // 64 - Not a style
  static Ph = 0b1000000;
  // 128
  static R = 0b10000000;
  // 256
  static S = 0b100000000;
  // 512
  static Spans = 0b1000000000;
  // 1024
  static ThickBot = 0b10000000000;
  // 2048
  static ThickTop = 0b100000000000;
}

type FormulaEntry = [normalized: string, tokens: any[], a1: string];
const defaultMergeFormula = (from: [RangedValue, b: RangedValue], destination: IRange.Coords, orientation: IRange.Orientation): IRange.Coords | null | undefined => {
  if (from[0].value[0] === from[1].value[0]) return destination;
  return undefined;
}

const _reuseRefRange: IRange.Coords = { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 };
// const _reuseFormulaRefRange: IRange.Coords = { colStart: 0, colEnd: 0, rowStart: 0, rowEnd: 0 };

/**
 * Special handler optimized for performance while reading sheet data.
 *
 * TODO - **PERFORMANCE**. Create a saxes flag that says to not build attribute object and event only (less objects and less lookups but would be per tag type)
 */
export const createSheetDataSaxVisitor = (
  tupleBuilder: Tuple.IBuilder<ICell.JSON>,
  sheet: ISheet.JSON,
  delegate: SaxParser.EventHandler,
  onWarning: (message: string) => void,
  onProgress: (amount: number, total?: number) => void,
  inlineStringDelegate: SaxParser.EventHandler<number>,
  paramMap?: Map<string, any>
): SaxParser.EventHandler => {
  let isRow:boolean = false;
  let isValue:boolean = false;

  let cellStyles:ITypes.RangeCoordValue<number>[] = [];

  let isFormulaSingle:boolean = false;
  let formulaSharedKey:string = null;
  let formulaRef:string = null;
  let formulaN:string = null; // normalized formula (R1C1)
  let formula:FormulaEntry = null; // A1 style formula (R1C1)

  // hashmap cache.
  let lastFormulaShareKey:string = null; // A1 style formula (R1C1)
  let lastFormula:FormulaEntry = null; // A1 style formula (R1C1)

  const richValues: any[] = paramMap?.get('richData') ?? [];
  const normalizeA1ToR1C1 = AddressUtils.normalizeA1ToR1C1; // micro optimization
  const conflatingFormulas:CoordUtils.IConflatingRanges<FormulaEntry> = CoordUtils.createConflatingRanges();
  /* we need to track these as multiple rows will use the same one. */
  const sharedFormulas:Map<string, FormulaEntry> = new Map();

  const dynamicArray:[ref: string, error: boolean][] = [];
  let currentDynamicArray:[ref: string, error: boolean] = null;

  const conflatingVolatile:CoordUtils.IConflatingRanges = CoordUtils.createConflatingRanges();

  let isInlineString:boolean = false; // inline string
  let currentRow:number = -1;
  let currentCol:number = -1;
  let currentValue:any = null;
  let currentCell:SaxParser.Tag;
  let currentType:string = null;

  const rowHeaders:ICellHeader.JSON[] = [];

  let lastStyledRow:ICellHeader.JSON = null;
  let lastStyleRowIndex:number = -2;

  let styledRowMask: number = 0;

  let aHt:string = '';
  let aCustomHeight:string = '';
  let aHidden:string = '';
  let aCustomFormat:string = '';
  let aS:string = '';
  let aOutlineLevel:string = '';
  let aCollapsed:string = '';

  let lHt:string = '';
  let lCustomHeight:string = '';
  let lHidden:string = '';
  let lCustomFormat:string = '';
  let lS:string = '';
  let lOutlineLevel:string = '';
  let lCollapsed:string = '';

  let isRowDifferent:boolean = true;

  // row oriented
  let lastStyle:ITypes.RangeCoordValue<number> = null;

  /*
   * we have a special case where we need to track unstyled cells if we have header styles
   * our current approach is to just add if there are any styled columns but check per row.
   */
  let scannedCols:boolean = false;
  let hasColumnStyles:boolean = false;
  let currentRowStyle:string = null;
  // messy way to track progress but we don't have a count of rows up front.
  let count: number = 0;
  const progressInterval: number = 8192 * 24;
  const onOpenTag = (tag: SaxParser.Tag) => {
    /* **PERFORMANCE** - we could set the xmlns: true on Saxes and then call tag.local but this is faster (and less robust) */
    let local = tag.name;
    const colon = local.indexOf(":");
    if (colon !== -1) {
      local = local.slice(colon + 1);
    }
    count++;
    if (count % progressInterval === 0) {
      onProgress(count);
    }
    if (currentCell) {
      const tagAttributes = tag.attributes;
      switch (local) {
        case 'v':
          isValue = true;
          break;
          // return;
        case 'f':
          const t:string = tagAttributes['t'] as string ?? null;
          switch (t) {
            case null:
            case 'normal':
              isFormulaSingle = true;
              break;
            case 'shared':
              const si:string = tagAttributes['si'] as string;
              formulaRef = tagAttributes['ref'] as string;
              if (!formulaRef) {
                // REVISIT - if the document is formatted correctly this isn't needed because if there is no ref the formula fields should be empty.
                // we could instead add a frozen formula to force an error and avoid a map lookup.
                formulaSharedKey = si;
              } else {
                formulaSharedKey = si;
                // TODO - warn - we need to get the formula text
                // formulaPair = text;//[ ref, null ]; // set formula on text tag
                // sharedFormulas.set(si, currentFormula);
              }
              break;
            case 'array':
              isFormulaSingle = true;
              formulaRef = tagAttributes['ref'] as string;
              //const aAca:string = tag.attributes['ref'] as string;
              //const:boolean aca = aAca !== undefined && (aAca === '1' || aAca === 'true')
              currentDynamicArray = [ formulaRef, false ];
              break;
            case 'datatable':
              isFormulaSingle = true;
              // Excel doesn't seem to use the values any longer. In fact they seem to just duplicate the formula.
              // I think I will post process these. If we have a tables (or a formula with a structured reference)
              // We can try to conflate the structured references (that are contained with a column).
              // Would be nice to add to table definition (they can vary so grab the one with the 'most similarities')
              formulaRef = tagAttributes['ref'] as string;
              if (formulaRef) {
                isFormulaSingle = true;
                // currentFormula = [ ref, null ]; // set formula on text tag
              } else {
                isFormulaSingle = true;
                // currentFormula = [ currentCell.attributes['r'] as string, null ]; // set formula on text tag
              }
              // del1
              // del2
              // dt2D
              // dtr
              // r1
              // r2
              break;
          };
          // ? If manually removed this from rand does excel do?
          const ca:string = tagAttributes['ca'] as string; // calculate always - volatile.
          if (ca !== undefined) {
            conflatingVolatile.append(currentRow, currentCol);
          }
          // only do if type array?
          // const aca:string = tagAttributes['aca'] as string; // array calculate always - volatile.
          // if (aca !== undefined) {
          //   // is this correct?
          //   // conflatingVolatile.append(currentRow, currentCol);
          // }
          // const bx:string = tagAttributes['bx'] as string; // ? assigns value to name (let?)
          break;
        case 'is':
          // excel also checks to ensure the also delegate this because they can be 'complicated'
          isInlineString = true;
          return;
      }
      if (isInlineString) {
        inlineStringDelegate?.onOpenTag(tag);
      }
      // extLst
      return;
    }
    if (isRow) {
      if (local === 'c') { // is this the only child allowed is so then we don't need to check
        currentCell = tag;
        const r = tag.attributes['r'] as string;
        currentCol = AddressUtils.fastStringToCol(r);
        const t = tag.attributes['t'] as string;
        if (t === undefined) {
          currentType = null;
        } else {
          currentType = t;
          /* if the type 'str' we capture this so that the 'v' tag and 'f' can both delegate to openTag */
          if (currentType === 'str') {
            isInlineString = true;
          }
        }
        let s:any = tag.attributes['s'] as string;
        /** if no style but we are in a style header we record as 0 (normal) */
        if (s === undefined) {
          if (currentRowStyle !== null || hasColumnStyles) {
            s = '0';
          }
        }
        // if (s === currentRowStyle) { // optimization.
        //   s = undefined;
        // }
        if (s !== undefined) {
          s = parseInt(s);
          if (lastStyle && lastStyle.value === s && lastStyle.colEnd + 1 === currentCol) {
            lastStyle.colEnd = currentCol;
          } else {
            lastStyle = {
              colStart: currentCol,
              rowStart: currentRow,
              colEnd: currentCol,
              rowEnd: currentRow,
              value: s,
            }
            cellStyles.push(lastStyle);
          }
        }
      }
      // ph: boolean
      // cm: number; // cell metadata
      // vm: number; // value metadata
      return;
    }
    if (local === 'row') {
      isRow = true;
      // **PERFORMANCE** - use attribute event could be faster but not sure how much
      const r = tag.attributes['r'] as string;
      currentRow = parseInt(r) - 1;
      // capture values and mask
      styledRowMask = 0;
      aCustomHeight = tag.attributes['customHeight'] as string;
      if (aCustomHeight !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.CustomHeight;
      }
      if (aCustomHeight !== lCustomHeight) {
        isRowDifferent = true;
        lCustomHeight = aCustomHeight;
      }

      aHt = tag.attributes['ht'] as string;
      if (aHt !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.Ht;
      }
      if (aHt !== lHt) {
        isRowDifferent = true;
        lHt = aHt;
      }
      aHidden = tag.attributes['hidden'] as string;
      if (aHidden !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.Hidden;
      }
      if (aHidden !== lHidden) {
        isRowDifferent = true;
        lHidden = aHidden;
      }
      aS = tag.attributes['s'] as string;
      if (aS !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.S;
      }
      if (aS !== lS) {
        isRowDifferent = true;
        lS = aS;
      }
      aCustomFormat = tag.attributes['customFormat'] as string;
      if (aCustomFormat !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.CustomFormat;
      }
      if (aCustomFormat !== lCustomFormat) {
        isRowDifferent = true;
        lCustomFormat = aCustomFormat;
      }
      aOutlineLevel = tag.attributes['outlineLevel'] as string;
      if (aOutlineLevel !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.OutlineLevel;
      }
      if (aOutlineLevel !== lOutlineLevel) {
        isRowDifferent = true;
        lOutlineLevel = aOutlineLevel;
      }
      aCollapsed = tag.attributes['collapsed'] as string;
      if (aCollapsed !== undefined) {
        styledRowMask = styledRowMask | RowAttributeType.Collapsed;
      }
      if (aCollapsed !== lCollapsed) {
        isRowDifferent = true;
        lCollapsed = aCollapsed;
      }

      // ph - phonetic? Why
      // spans - optimization, not used
      // thickBot - optimization, not used
      // thickTop - optimization, not used

      if (styledRowMask !== 0) {
        if (lastStyleRowIndex + 1 === currentRow && !isRowDifferent) {
          lastStyledRow.max = currentRow;
        } else {
          // we always set every value to ensure that the values are monomorphic.
          const csz:boolean = aCustomHeight !== undefined && (aCustomHeight === '1' || aCustomHeight === 'true');
          const cs:boolean = aCustomFormat !== undefined && (aCustomFormat === '1' || aCustomFormat === 'true')
          currentRowStyle = cs && aS !== undefined ? aS : null;
          lastStyledRow = {
            min: currentRow,
            max: currentRow,
            sz: aHt === undefined ? -1 : parseFloat(aHt), // we want this to be monomorphic
            csz,
            h: aHidden !== undefined && (aHidden === '1' || aHidden === 'true'),
            s: currentRowStyle === null ? undefined : (currentRowStyle === '0' ? 0 : parseInt(currentRowStyle)),
            // cs, // we don't use cs
            l: (aOutlineLevel === undefined) || (aOutlineLevel === '0') ? 0 : parseInt(aOutlineLevel),
            cl: aCollapsed !== undefined && (aCollapsed === '1' || aCollapsed === 'true')
          };
          rowHeaders.push(lastStyledRow);
        }
      }
      // reset
      lastStyleRowIndex = currentRow;
      isRowDifferent = false;
      return;
    }
    if (!scannedCols && local === 'sheetData') { // OOXML guarantees cols before sheetData
      scannedCols = true;
      const cols = sheet.cols;
      const colsLength = cols ? cols.length : 0;
      for (let i=0; !hasColumnStyles && i<colsLength; i++) {
        const col = cols[i];
        if (col.s) { // defined and !== 0.
          hasColumnStyles = true;
        }
      }
    }
    delegate?.onOpenTag(tag);
  }

  const onCloseTag = (tag: SaxParser.Tag) => {
    if (currentCell) { // } && local === 'c') { // Not needed as we only set currentCell on local === 'c' open. Assumes well formed xml.
      /* **PERFORMANCE** - we could set the xmlns: true on Saxes and then call tag.local but this is faster (and less robust) */
      let local = tag.name;
      const colon = local.indexOf(":");
      if (colon !== -1) {
        local = local.slice(colon + 1);
      }

      if (isInlineString) {
        if (local === 'is' || local === 'v') {
          const retValue:number = inlineStringDelegate?.onEnd();
          if (retValue !== null) {
            tupleBuilder.addValue(currentRow, currentCol, '' + retValue);
            // tupleBuilder.addValue(currentRow, currentCol, { t: ScalarType.String, v: retValue });
          }
        } else {
          inlineStringDelegate?.onCloseTag?.(tag);
        }
        // return;
      }
      // inline strings are also values.
      if (isValue) {
        isValue = false;
        // return;
      }

      if (local === 'c') {
        currentCell = null;
        // closing for a is, v
        isInlineString = false;
      }
      return;
    }
    if (isRow) {
      isRow = false;
      lastStyle = null;
      return;
    }
    delegate?.onCloseTag(tag);
  }

  const onText = (text: string) => {
    text = text.trim();
    if (isValue) {
      currentValue = null;
      switch (currentType) {
        // TODO - the type marshalling belongs in tuple builder except we can't do this with string
        // By doing marshalling in the tuple builder we can:
        //  1. Optimize monomorphic types.
        case null:
        case 'n':
          currentValue = parseFloat(text);
          break;
        case 'b':
          currentValue = (text === '1' || text === 'true');
          // currentValue = { t: ScalarType.Boolean, v: (text === '1' || text === 'true') ? 1 : 0 };
          break;
        case 's': // shared string
          currentValue = text;
          // currentValue = { t: ScalarType.String, v: parseInt(text) }; // We need to either make this a look ur inline a lookup
          break;
        case 'e': // formula
          if (text === `#VALUE!`) {
            const vm = currentCell.attributes["vm"] as string;
            if (vm !== undefined) {
              const richValue = richValues[parseInt(vm) - 1];
              if (richValue && (richValue as FormulaError.Known).isFormulaError) {
                currentValue = { t: ScalarType.Error, v: richValue.getCode() };
                break;
              }
            }
          }
          const asError = FormulaError.getBuiltInByLabel(text);
          if (asError) {
            currentValue = { t: ScalarType.Error, v: asError.getCode() };
          } else {
            currentValue = text;
            onWarning?.(`Unknown formula error '${text}' in cell ${AddressUtils.cellToString({ colIndex: currentCol, rowIndex: currentRow })}`);
          }
          break;
        // inline string delegates to inlineStringDelegate to support rich text types.
        case 'str': // formula string
          /* **Observation** - This is supposed to be an inline formula but if a value is detected this is also used */
          isInlineString = true;
          break;
        case 'inlineStr': // inline string
          isInlineString = true;
          break;
        default:
          // warn of something else
          // console.warn('invalid call type', currentType);
      }
      if (currentValue !== null) {
        tupleBuilder.addValue(currentRow, currentCol, currentValue);
      }
    }
    if (currentDynamicArray) {
      if (currentType === 'e') { // we should set a iserror variable
        currentDynamicArray[1] = true; // error
      }
      dynamicArray.push(currentDynamicArray);
      currentDynamicArray = null;
    }

    if (formulaSharedKey) {
      // we cache key that checks last lastSharedKey to avoid map lookup (sometimes)
      if (lastFormulaShareKey === formulaSharedKey) {
        formula = lastFormula;
      } else {
        formula = sharedFormulas.get(formulaSharedKey);
        if (!formula) {
          const tokens = [];
          formulaN = normalizeA1ToR1C1(text, currentRow, currentCol, tokens);
          formula = [ formulaN, tokens, text ];
          sharedFormulas.set(formulaSharedKey, formula);
        }
        lastFormulaShareKey = formulaSharedKey;
        lastFormula = formula;
      }
    }
    if (isFormulaSingle) {
      const tokens = [];
      formulaN = normalizeA1ToR1C1(text, currentRow, currentCol, tokens);
      formula = [ formulaN, tokens, text ];
    }
    if (formula) {
      conflatingFormulas.append(currentRow, currentCol, formula);
      formula = null;
      isFormulaSingle = false;
      formulaSharedKey = null;
      formulaRef = null;
      return;
    }
    if (isInlineString) { // inline
      inlineStringDelegate?.onText(text);
      return;
    }
    if (!isRow) {
      delegate?.onText(text);
      return;
    }
  }

  const onEnd = () => {
    if (rowHeaders.length > 0) {
      sheet.rows = rowHeaders;
    }

    let formulas = conflatingFormulas.done(defaultMergeFormula);
    const formulasLength = formulas.length;
    if (formulasLength > 0) {
      const asFormulaEntries:[address: string, text: string][] = new Array(formulasLength);
      for (let i=0; i<formulasLength; i++) {
        const formulaPair = formulas[i];
        const ref = AddressUtils.rangeToString(formulaPair);
        const tokens = formulaPair.value[1];
        const asLocalA1 = AddressUtils.resolveRelativeToA1(tokens, formulaPair.rowStart, formulaPair.colStart);
        asFormulaEntries[i] = [ref, asLocalA1];
      }
      sheet.formulas = asFormulaEntries;
    }

    const volatiles = conflatingVolatile.done(true);
    const volatilesLength = volatiles.length;
    if (volatilesLength > 0) {
      const jsonVolatiles:string[] = new Array(volatilesLength);
      for (let i=0; i<volatilesLength; i++) {
        const volatile = volatiles[i];
        const ref = AddressUtils.rangeToString(volatile);
        jsonVolatiles[i] = ref;
      }
      sheet.volatile = jsonVolatiles;
    }

    const dynamicArrayLength = dynamicArray.length;
    if (dynamicArrayLength > 0) {
      sheet.dynamicArray = [...dynamicArray];
    }

    if (cellStyles.length > 0) {
      cellStyles.sort(CoordUtils.createRangeComparator(IRange.Orientation.Column));
      const mergedStyles:ITypes.RangeCoordValue<number>[] = [];
      let lastStyle:ITypes.RangeCoordValue<number> = null;
      let lastColStart: number = -1;
      let lastColEnd: number = -1;
      let lastRowEnd: number = -1;
      let lastS: number = -1;
      let nextStyle = null;
      const stylesLength = cellStyles.length;
      if (stylesLength > 0) {
        lastStyle = cellStyles[0];
        lastColStart = lastStyle.colStart;
        lastColEnd = lastStyle.colEnd;
        lastRowEnd = lastStyle.rowEnd;
        lastS = lastStyle.value;
        mergedStyles.push(lastStyle);
      }
      for (let i=1; i<stylesLength; i++) {
        nextStyle = cellStyles[i];
        if (lastS === nextStyle.value &&
            lastColStart === nextStyle.colStart && lastColEnd === nextStyle.colEnd &&
            lastRowEnd + 1 === nextStyle.rowEnd) {
          lastRowEnd = nextStyle.rowEnd;
          lastStyle.rowEnd = lastRowEnd;
          continue;
        } else {
          mergedStyles.push(nextStyle);
        }
        lastStyle = nextStyle;
        lastColStart = lastStyle.colStart;
        lastColEnd = lastStyle.colEnd;
        lastRowEnd = lastStyle.rowEnd;
        lastS = lastStyle.value;
      }

      let directStyles: { r: IRange.Coords, v: number }[] = [];
      for (let i=0; i<mergedStyles.length; i++) {
        const mergedStyle = mergedStyles[i];
        directStyles.push({
          r: {
            colStart: mergedStyle.colStart,
            colEnd: mergedStyle.colEnd,
            rowStart: mergedStyle.rowStart,
            rowEnd: mergedStyle.rowEnd
          },
          v: mergedStyle.value
        });
      // /**
      //  * TODO - walk through each cells style and merge with borders (we can do this on style extract and not here it think?)
      //  * style = _Utils.tileStyleBorders(style, styleRef, this._styles);
      //  */
      }
      sheet.directStyles = directStyles;
    }
    const boundedTuples:any = tupleBuilder.build(); // IGrid.BoundedTuples
    if (boundedTuples) {
      const tuples:any = boundedTuples.tuples;
      sheet.data = tuples;
      // console.log('read data', boundedTuples.bounds);
    }

    // console.log(`eval ${formulas.size} formulas`);
    delegate?.onEnd?.();
  }
  return {
    ...delegate,
    onEnd,
    onOpenTag,
    onCloseTag,
    onText
  }
}