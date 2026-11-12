import { type Scalar } from './Scalar';

/**
 * The kind of a rich value: its class. A kind is a static set of typed property definitions, and
 * every value of a kind shares the one `IRichType` its {@link IRichData.getKind} returns.
 *
 * @remarks
 * For introspection: a renderer, a card, a formula editor offering `A1.` completions, or a
 * function reading a field asks the value's kind which properties it has. What a value reads as
 * where a primitive is consumed is the value's own answer ({@link IRichData.toPrimitive}).
 */
export interface IRichType {
  /**
   * The kind's name: what a value's JSON names as its `type`.
   */
  getName(): string;
  /**
   * The name a UI shows for the kind, such as in a list of what can be inserted. The name when the
   * kind has no label of its own.
   */
  getLabel(): string;
  /**
   * The kind's properties, in the order the kind declares them.
   */
  getProperties(): readonly IRichType.Property[];
  /**
   * The property `name`, or `null` when the kind has none by that name.
   */
  getProperty(name: string): IRichType.Property | null;
  /**
   * The property whose value is the text a cell shows for a value of this kind, or `null` when
   * the kind shows none (an image).
   */
  getDisplayProperty(): string | null;
  /**
   * The kind's own presentation (a card, an icon, a provider), or `null` for none.
   */
  getMeta(): IRichMeta | null;
}

export namespace IRichType {
  /**
   * What a property holds.
   *
   * @remarks
   * `rich` is another rich value (a capital city, an image); `array` is an array value; `resource`
   * is a workbook resource such as a picture's bytes.
   */
  export type ValueType = 'number' | 'integer' | 'string' | 'boolean' | 'error' | 'rich' | 'array' | 'resource';

  /**
   * One property a kind declares.
   */
  export interface Property {
    /** The property's name. */
    readonly name: string;
    /** What it holds. */
    readonly valueType: ValueType;
    /** What it reads as on a value that holds none. Omitted, `null`. */
    readonly defaultValue?: Scalar;
    /** How the property shows, unless a value says otherwise. */
    readonly meta?: IRichMeta;
  }

  /**
   * A kind saved with the workbook whose values name it: one that is not registered in code, such
   * as a kind read from a file.
   */
  export interface JSON {
    /** {@inheritDoc IRichType.getName} */
    name: string;
    /** {@inheritDoc IRichType.getLabel} */
    label?: string;
    /** {@inheritDoc IRichType.getProperties} */
    properties?: readonly Property[];
    /** {@inheritDoc IRichType.getDisplayProperty} */
    displayProperty?: string | null;
    /** {@inheritDoc IRichType.getMeta} */
    meta?: IRichMeta;
  }
}

/**
 * How a rich value, or one of its properties, is presented: the number format and caption of a
 * property, where it is offered, its sources; a kind's card, icon and provider.
 *
 * @remarks
 * Presentation only, never a value. A kind gives each of its properties a default; a value gives
 * one only for a property where it differs (a price in another currency).
 */
export interface IRichMeta {
  /** The number format a number property shows in. */
  readonly numberFormat?: string;
  /** A short caption shown beside the property, such as its unit or the year of its data. */
  readonly sublabel?: string;
  /** Where the property is not offered. Each omitted entry is `false`. */
  readonly excludeFrom?: IRichMeta.ExcludeFrom;
  /** Where the property's data comes from and under what license. */
  readonly attribution?: readonly IRichMeta.Attribution[];
  /** A kind's card. */
  readonly card?: IRichMeta.Card;
  /** A kind's icon, by name. */
  readonly icon?: string;
  /** Who provides a kind's data. */
  readonly provider?: IRichMeta.Provider;
}

export namespace IRichMeta {
  /** Where a property is not offered. */
  export interface ExcludeFrom {
    /** Not shown on the card. */
    readonly cardView?: boolean;
    /** Not offered after `A1.` in a formula. */
    readonly dotNotation?: boolean;
    /** Not offered by formula autocomplete. */
    readonly autoComplete?: boolean;
    /** A change to the property is not a change to the value. */
    readonly calcCompare?: boolean;
  }

  /** One source of a property's data. */
  export interface Attribution {
    readonly sourceText?: string;
    readonly sourceAddress?: string;
    readonly licenseText?: string;
    readonly licenseAddress?: string;
  }

  /** A kind's card: which properties it shows, and how. */
  export interface Card {
    /** The properties shown, in order. Omitted, the kind's order. */
    readonly order?: readonly string[];
    /** The property shown as the title. */
    readonly title?: string;
    /** The property shown under the title. */
    readonly subTitle?: string;
    /** The image property shown at the top. */
    readonly mainImage?: string;
  }

  /** Who provides a kind's data. */
  export interface Provider {
    readonly description?: string;
    readonly logoSourceAddress?: string;
    readonly logoTargetAddress?: string;
  }
}
