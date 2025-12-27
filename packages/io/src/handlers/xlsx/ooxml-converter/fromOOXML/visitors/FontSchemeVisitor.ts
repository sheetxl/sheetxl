import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { ITheme, IStyledFont, IFont } from '@sheetxl/sdk';

export class FontSchemeVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: ITheme.JSON): ITheme.FontSchemeJSON {
    const jsonFontScheme:ITheme.FontSchemeJSON = {} as ITheme.FontSchemeJSON;

    jsonFontScheme.name = elemParent.getAttribute("name");

    const elemMajorFont: Element = context.evaluate("majorFont", elemParent) as Element;
    const jsonMajorFont = this.processFontElement(context, elemMajorFont, {});
    jsonFontScheme.majorFont = jsonMajorFont.family;
    if (jsonMajorFont.fallbacks) {
      jsonFontScheme.majorFallbacks = jsonMajorFont.fallbacks;
    }

    const elemMinorFont: Element = context.evaluate("minorFont", elemParent) as Element;
    const jsonMinorFont = this.processFontElement(context, elemMinorFont, {});
    jsonFontScheme.minorFont = jsonMinorFont.family;
    if (jsonMajorFont.fallbacks) {
      jsonFontScheme.minorFallbacks = jsonMinorFont.fallbacks;
    }

    jsonParent.fonts = jsonFontScheme;
    return jsonFontScheme;
  }

  // TODO - parseTextProperties (this has full font information and eventually support for other dialects)
  processFontElement(context: ExecutionContext, elem: Element, jsonFont: Partial<IStyledFont.Properties>): Partial<IStyledFont.Properties> {
    if (!elem) return;
    const elemLatin: Element = context.evaluate("latin", elem) as Element;
    if (!elemLatin) {
      return;
    }
    const typeface: string = elemLatin.getAttribute("typeface");
    if (typeface) {
      jsonFont.family = typeface;
    }
    const panose: string = elemLatin.getAttribute("panose");
    if (panose) {
      jsonFont.fallbacks = [IFont.getPanoseFallback(panose)];
    }

    return jsonFont;
  }

  // afterVisit(context: ExecutionContext, chartSpaceElement: Element, jsonChartSpace: any/*JSON*/): void {}
}