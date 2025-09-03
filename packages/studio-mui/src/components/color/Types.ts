
export const ColorPanelType = {
  Preset: 'preset',
  Custom: 'custom'
} as const;
export type ColorPanelType = typeof ColorPanelType[keyof typeof ColorPanelType];

export const AutoColorPosition = {
  Start: 'start',
  End: 'end'
} as const;
export type AutoColorPosition = typeof AutoColorPosition[keyof typeof AutoColorPosition];
