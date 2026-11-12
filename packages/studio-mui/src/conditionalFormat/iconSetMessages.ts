import { messageKey } from '@sheetxl/utils';

import { type TranslateFn } from '@sheetxl/utils-react';

import {
  describeConditionalIcon, type ConditionalIconSpec, type ConditionalIconTone, type IconSetGalleryBlock
} from '@sheetxl/react';

/** Heading catalog keys for the icon-set gallery blocks, by {@link IconSetGalleryBlock.key}. */
export const ICON_GROUP_MESSAGE_KEYS: Record<IconSetGalleryBlock['key'], string> = {
  directional: messageKey('conditionalFormat.iconGroup.directional'),
  shapes: messageKey('conditionalFormat.iconGroup.shapes'),
  indicators: messageKey('conditionalFormat.iconGroup.indicators'),
  ratings: messageKey('conditionalFormat.iconGroup.ratings')
};

/**
 * The tint half of an icon's name — "Green" in "Green Up Arrow".
 */
const TONE_MESSAGE_KEYS: Record<ConditionalIconTone, string> = {
  bad: messageKey('conditionalFormat.iconTone.bad'),
  lightBad: messageKey('conditionalFormat.iconTone.lightBad'),
  neutral: messageKey('conditionalFormat.iconTone.neutral'),
  good: messageKey('conditionalFormat.iconTone.good'),
  purple: messageKey('conditionalFormat.iconTone.purple'),
  gold: messageKey('conditionalFormat.iconTone.gold'),
  gray: messageKey('conditionalFormat.iconTone.gray'),
  black: messageKey('conditionalFormat.iconTone.black')
};

/**
 * The shape half of an icon's name, by glyph key in the `cf` pack — Excel's words where it has
 * them ("Side Arrow", "Up Inclined Arrow", "Check Symbol" for the circled check).
 */
const SHAPE_MESSAGE_KEYS: Record<string, string> = {
  arrowUp: messageKey('conditionalFormat.iconShape.arrowUp'),
  arrowUpRight: messageKey('conditionalFormat.iconShape.arrowUpRight'),
  arrowRight: messageKey('conditionalFormat.iconShape.arrowRight'),
  arrowDownRight: messageKey('conditionalFormat.iconShape.arrowDownRight'),
  arrowDown: messageKey('conditionalFormat.iconShape.arrowDown'),
  triangleUpSharp: messageKey('conditionalFormat.iconShape.triangleUpSharp'),
  triangleDownSharp: messageKey('conditionalFormat.iconShape.triangleDownSharp'),
  dash: messageKey('conditionalFormat.iconShape.dash'),
  circle: messageKey('conditionalFormat.iconShape.circle'),
  circleRimmed: messageKey('conditionalFormat.iconShape.circleRimmed'),
  triangleUp: messageKey('conditionalFormat.iconShape.triangleUp'),
  diamond: messageKey('conditionalFormat.iconShape.diamond'),
  flag: messageKey('conditionalFormat.iconShape.flag'),
  check: messageKey('conditionalFormat.iconShape.check'),
  cross: messageKey('conditionalFormat.iconShape.cross'),
  exclamation: messageKey('conditionalFormat.iconShape.exclamation'),
  circleCheck: messageKey('conditionalFormat.iconShape.circleCheck'),
  circleCross: messageKey('conditionalFormat.iconShape.circleCross'),
  circleExclamation: messageKey('conditionalFormat.iconShape.circleExclamation'),
  rating0: messageKey('conditionalFormat.iconShape.rating0'),
  rating1: messageKey('conditionalFormat.iconShape.rating1'),
  rating2: messageKey('conditionalFormat.iconShape.rating2'),
  rating3: messageKey('conditionalFormat.iconShape.rating3'),
  rating4: messageKey('conditionalFormat.iconShape.rating4'),
  star0: messageKey('conditionalFormat.iconShape.star0'),
  star1: messageKey('conditionalFormat.iconShape.star1'),
  star2: messageKey('conditionalFormat.iconShape.star2'),
  boxes0: messageKey('conditionalFormat.iconShape.boxes0'),
  boxes1: messageKey('conditionalFormat.iconShape.boxes1'),
  boxes2: messageKey('conditionalFormat.iconShape.boxes2'),
  boxes3: messageKey('conditionalFormat.iconShape.boxes3'),
  boxes4: messageKey('conditionalFormat.iconShape.boxes4'),
  quarters0: messageKey('conditionalFormat.iconShape.quarters0'),
  quarters1: messageKey('conditionalFormat.iconShape.quarters1'),
  quarters2: messageKey('conditionalFormat.iconShape.quarters2'),
  quarters3: messageKey('conditionalFormat.iconShape.quarters3'),
  quarters4: messageKey('conditionalFormat.iconShape.quarters4')
};

/**
 * Shapes whose name already says how they are lit — a "Gold Star" or "3 Filled Bars" is not also
 * "Gray"; the tint is the shape's own and is not spelled out.
 */
const SELF_TONED = /^(rating|star|boxes|quarters)\d$/;

/** The tone-and-shape name template — `{tone} {shape}`. */
const ICON_NAME_KEY = messageKey('conditionalFormat.iconName');

/**
 * The name of one icon — "Green Up Arrow", "Half Gold Star" — for a tooltip or a reader.
 */
export const iconDisplayName = (t: TranslateFn, spec: ConditionalIconSpec): string => {
  const { shape, tone } = describeConditionalIcon(spec);
  const shapeName = SHAPE_MESSAGE_KEYS[shape] ? t(SHAPE_MESSAGE_KEYS[shape]) : shape;
  if (SELF_TONED.test(shape)) return shapeName;
  return t(ICON_NAME_KEY, { tone: t(TONE_MESSAGE_KEYS[tone]), shape: shapeName });
};
