import { IColor, Color } from '@sheetxl/sdk';

export const createLabeledColorDef = (description: string, val: string): IColor.DefinitionWithLabel => {
  return {
    description: description,
    definition: {
      val: val,
      adjs: []
    }
  }
}

export const addPreset = (
  description: string,
  colorKey: string,
  schemeLookup: IColor.SchemeLookup,
  arr: IColor.DefinitionWithLabel[],
  mapByString: Map<string, IColor>,
  mapByRGBString: Map<string, IColor>
) => {
  const colorDef = createLabeledColorDef(description, colorKey);
  arr?.push(colorDef);
  const adjustedColor = new Color({ val: colorDef.definition.val, adjs: colorDef.definition.adjs }, schemeLookup);
  const asString = adjustedColor.toString();
  mapByString?.set(asString, adjustedColor);
  const asRGBString = adjustedColor.toRGBA().toString();
  mapByRGBString?.set(asRGBString, adjustedColor);
}