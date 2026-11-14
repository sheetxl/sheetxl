/* cspell: disable */
import {
  FormulaContext, FormulaError, ValueKind,
  type AcceptError, type Scalar, type NoLift
} from '@sheetxl/primitives';

/**
 * Converts a number from one measurement system to another.
 * @param number is the value in fromUnit to convert.
 * @param fromUnit is the units for number.
 * @param toUnit is the units for the result.
 */
export function CONVERT(
  number: NoLift<Scalar>,
  fromUnit: NoLift<AcceptError<Scalar>>,
  toUnit: NoLift<AcceptError<Scalar>>
): number {
  // LEFT TO RIGHT, and the number's COERCION counts as its fault: `CONVERT("zz","km",NA())` is
  // #VALUE! and not the #N/A a later slot would raise. The unit slots therefore take their errors
  // as values and this body raises them, in order, once the number has been read.
  //
  // A blank cell is zero, not a refusal: `CONVERT(<blank>,"km","m")` is 0. An empty comma is one:
  // `CONVERT(,"km","m")` is #N/A.
  if (FormulaContext.getArgs().getKindAt(0) === ValueKind.Omitted) throw FormulaError.BuiltIn.NA;
  number = (number === null || number === undefined) ? 0 : FormulaContext.parseAsNumber(number);
  fromUnit = readUnit(fromUnit);
  toUnit = readUnit(toUnit);

  const from = readUnitSpelling(fromUnit);
  const to = readUnitSpelling(toUnit);
  if (from === null || to === null || from.unit[3] !== to.unit[3]) {
    throw FormulaError.BuiltIn.NA;
  }

  // TEMPERATURE is affine, not a ratio. A prefix (only the kelvin takes one) scales the reading on
  // its own scale: `CONVERT(1,"kK","C")` is 1000 K read as Celsius, 726.85.
  if (from.unit[3] === 'temperature') {
    return convertTemperature(number * from.multiplier, from.unit[1], to.unit[1]) / to.multiplier;
  }

  // The two ratios, then the two prefixes: `CONVERT(1,"kmph","mph")` is exactly 1000 only when the
  // unit's own ratio cancels first.
  return number * (from.unit[5] / to.unit[5]) * (from.multiplier / to.multiplier);
}

/**
 * A unit slot's text, or the error it earns.
 *
 * @remarks
 * A BOOLEAN is a type error and not an unknown unit — `CONVERT(1,TRUE,"m")` is `#VALUE!` where
 * every other unrecognized spelling is `#N/A`. Anything else is read as its own text, so a number
 * spells itself and then finds nothing.
 */
function readUnit(unit: AcceptError<Scalar>): string {
  if (FormulaError.isError(unit)) throw unit;
  if (typeof unit === 'boolean') throw FormulaError.BuiltIn.Value;
  return (unit === null || unit === undefined) ? '' : String(unit);
}

/**
 * The temperature scales, which are the one category CONVERT cannot do by ratio.
 *
 * @remarks
 * Excel pivots on CELSIUS — not on kelvin, which is the obvious guess and is wrong: routing
 * `1 C` to Fahrenheit through kelvin gives 33.799999999999955 where Excel answers exactly 33.8.
 *
 * Four pairs SHORT-CIRCUIT the pivot because they share a scale or a zero, and going through
 * Celsius would lose their last bit: Fahrenheit and Rankine differ by a pure 459.67 offset, and
 * kelvin and Rankine by a pure factor of 1.8. `CONVERT(0,"F","Rank")` is 459.67 exactly and the
 * round trip gives 459.66999999999996.
 *
 * `F` to `Reaumur` is the fifth exception and a subtler one: the two scale factors COMBINE before
 * the division rather than after, so it is `(x-32) * 0.8 / 1.8` and not `((x-32)/1.8) * 0.8`.
 * Réaumur otherwise goes through Celsius like everything else.
 *
 * The spellings are not interchangeable — each is the only arrangement of its constants that
 * reproduces every value of its pair.
 */
function convertTemperature(value: number, from: string, to: string): number {
  if (from === to) return value;
  const direct = TEMPERATURE_DIRECT[`${from}>${to}`];
  if (direct) return direct(value);
  return TEMPERATURE_FROM_C[to]!(TEMPERATURE_TO_C[from]!(value));
}

/** Each scale read as Celsius. */
const TEMPERATURE_TO_C: Record<string, (x: number) => number> = {
  C: (x) => x,
  F: (x) => (x - 32) / 1.8,
  K: (x) => x - 273.15,
  Rank: (x) => x / 1.8 - 273.15,
  Reau: (x) => x / 0.8,
};

/** Celsius written back out as each scale. */
const TEMPERATURE_FROM_C: Record<string, (c: number) => number> = {
  C: (c) => c,
  F: (c) => c * 1.8 + 32,
  K: (c) => c + 273.15,
  Rank: (c) => (c + 273.15) * 1.8,
  Reau: (c) => c * 0.8,
};

/** The pairs that do NOT go through Celsius. */
const TEMPERATURE_DIRECT: Record<string, (x: number) => number> = {
  'F>Rank': (x) => x + 459.67,
  'Rank>F': (x) => x - 459.67,
  'K>Rank': (x) => x * 1.8,
  'Rank>K': (x) => x / 1.8,
  'F>Reau': (x) => (x - 32) * 0.8 / 1.8,
};

/** Which prefixes a unit takes. `si+binary` is information only — `kibit` is 1024 bits. */
type Prefixes = 'none' | 'si' | 'si+binary';

/**
 * A unit: name, symbol, alternate symbols, quantity, the prefixes it takes, its ratio to the
 * quantity's base, and the power a prefix is raised to (`km2` is a million square meters).
 */
type Unit = readonly [
  name: string,
  symbol: string,
  alternates: readonly string[] | null,
  quantity: string,
  prefixes: Prefixes,
  ratio: number,
  power?: number
];

/**
 * Every unit CONVERT knows.
 *
 * @remarks
 * Every unit Excel has is here, with Excel's own factors — never retype one by hand, a typed
 * value lands on a neighboring double. Which prefixes each one takes is not guessable: `uk_pt`, `mmHg` and `mph` take SI prefixes, `ft`, `HP` and
 * `psi` take none, and only `bit` and `byte` take binary ones.
 *
 * The rest is a SUPERSET — SI and metric units Excel lacks (`Hz`, `V`, `bar`, `t`), which take SI
 * prefixes the way they do in print. A superset symbol never means anything to Excel, so it cannot
 * change an answer Excel gives; units whose symbols collide with one of Excel's (the coulomb with
 * Celsius `C`, the farad with Fahrenheit `F`, the katal with kilo-atmosphere `kat`) are left out.
 */
const units: readonly Unit[] = [
  ['a.u. of energy', 'Eh', null, 'energy', 'none', 4.35974417757576e-18],
  ['admiralty knot', 'admkn', null, 'speed', 'none', 0.5147733333333333],
  ['ampere', 'A', null, 'electric_current', 'si', 1],
  ['ampere per meter', 'A/m', null, 'magnetic_field_intensity', 'si', 1],
  ['ångström', 'Å', ['ang'], 'length', 'si', 1e-10],
  ['are', 'ar', null, 'area', 'si', 100],
  ['astronomical unit', 'ua', null, 'length', 'none', 1.49597870691667e-11],
  ['atmosphere', 'atm', ['at'], 'pressure', 'si', 101325],
  ['bar', 'bar', null, 'pressure', 'si', 100000],
  ['becquerel', 'Bq', null, 'radioactivity', 'si', 1],
  ['bit', 'bit', null, 'information', 'si+binary', 1],
  ['btu', 'BTU', ['btu'], 'energy', 'none', 1055.05585262],
  ['byte', 'byte', null, 'information', 'si+binary', 8],
  ['candela', 'cd', null, 'luminous_intensity', 'si', 1],
  ['cubic ångström', 'ang3', ['ang^3'], 'volume', 'si', 1e-30, 3],
  ['cubic foot', 'ft3', ['ft^3'], 'volume', 'none', 0.028316846592],
  ['cubic inch', 'in3', ['in^3'], 'volume', 'none', 0.000016387064],
  ['cubic light-year', 'ly3', ['ly^3'], 'volume', 'none', 8.467866646237152e+47],
  ['cubic metre', 'm3', ['m^3'], 'volume', 'si', 1, 3],
  ['cubic mile', 'mi3', ['mi^3'], 'volume', 'none', 4168181825.4405794],
  ['cubic nautical mile', 'Nmi3', ['Nmi^3'], 'volume', 'none', 6352182208],
  ['cubic Pica', 'Pica3', ['Picapt3', 'Pica^3', 'Picapt^3'], 'volume', 'none', 4.3903956618655696e-11],
  ['cubic yard', 'yd3', ['yd^3'], 'volume', 'none', 0.764554857984],
  ['cup', 'cup', null, 'volume', 'none', 0.00023658823649999998],
  ['dalton', 'Da', ['u'], 'mass', 'si', 1.660538782e-27],
  ['day', 'd', ['day'], 'time', 'none', 86400],
  ['degree', '°', null, 'angle', 'none', 0.0174532925199433],
  ['dyne', 'dyn', ['dy'], 'force', 'si', 0.00001],
  ['electronvolt', 'eV', ['ev'], 'energy', 'si', 1.602176487e-19],
  ['ell', 'ell', null, 'length', 'none', 1.143],
  ['erg', 'erg', ['e'], 'energy', 'si', 1e-7],
  ['fluid ounce', 'oz', null, 'volume', 'none', 0.000029573529562499998],
  ['foot', 'ft', null, 'length', 'none', 0.3048],
  ['foot-pound', 'flb', null, 'energy', 'none', 1.3558179483314003],
  ['gal', 'Gal', null, 'acceleration', 'si', 0.01],
  ['gallon', 'gal', null, 'volume', 'none', 0.0037854117839999997],
  ['gauss', 'G', ['ga'], 'magnetic_flux_density', 'si', 0.0001],
  ['grain', 'grain', null, 'mass', 'none', 0.00006479891000000001],
  ['gram', 'g', null, 'mass', 'si', 0.001],
  ['gray', 'Gy', null, 'absorbed_dose', 'si', 1],
  ['gross registered ton', 'GRT', ['regton'], 'volume', 'none', 2.8316846592],
  ['hectare', 'ha', null, 'area', 'none', 10000],
  ['henry', 'H', null, 'inductance', 'si', 1],
  ['hertz', 'Hz', null, 'frequency', 'si', 1],
  ['horsepower', 'HP', ['h'], 'power', 'none', 745.6998715822702],
  ['horsepower-hour', 'HPh', ['hh', 'hph'], 'energy', 'none', 2684519.537696173],
  ['hour', 'hr', null, 'time', 'none', 3600],
  ['imperial gallon (U.K.)', 'uk_gal', null, 'volume', 'none', 0.00454609],
  ['imperial hundredweight', 'lcwt', ['uk_cwt', 'hweight'], 'mass', 'none', 50.802345439999996],
  ['imperial quart (U.K)', 'uk_qt', null, 'volume', 'none', 0.0011365225],
  ['imperial ton', 'brton', ['uk_ton', 'LTON'], 'mass', 'none', 1016.0469088],
  ['inch', 'in', null, 'length', 'none', 0.0254],
  ['international acre', 'uk_acre', null, 'area', 'none', 4046.8564224],
  ['IT calorie', 'cal', null, 'energy', 'si', 4.1868],
  ['joule', 'J', null, 'energy', 'si', 1],
  ['kelvin', 'K', ['kel'], 'temperature', 'si', 1],
  ['kilogram', 'kg', null, 'mass', 'none', 1],
  ['knot', 'kn', null, 'speed', 'none', 0.5144444444444445],
  ['light-year', 'ly', null, 'length', 'si', 9460730472580800],
  ['litre', 'L', ['l', 'lt'], 'volume', 'si', 0.001],
  ['lumen', 'lm', null, 'luminous_flux', 'si', 1],
  ['lux', 'lx', null, 'illuminance', 'si', 1],
  ['maxwell', 'Mx', null, 'magnetic_flux', 'si', 1e-18],
  ['measurement ton', 'MTON', null, 'volume', 'none', 1.13267386368],
  ['meter per hour', 'm/h', ['m/hr'], 'speed', 'si', 0.0002777777777777778],
  ['meter per second', 'm/s', ['m/sec'], 'speed', 'si', 1],
  ['parsec', 'pc', ['parsec'], 'length', 'si', 30856775812815532],
  ['metre', 'm', null, 'length', 'si', 1],
  ['miles per hour', 'mph', null, 'speed', 'si', 0.44704],
  ['millimetre of mercury', 'mmHg', null, 'pressure', 'si', 133.322],
  ['minute', 'min', ['mn'], 'time', 'none', 60],
  ['modern teaspoon', 'tspm', null, 'volume', 'none', 0.000005],
  ['mole', 'mol', null, 'amount_of_substance', 'si', 1],
  ['morgen', 'Morgen', null, 'area', 'none', 2500],
  ['nautical mile', 'M', ['Nmi'], 'length', 'none', 1852],
  ['newton', 'N', null, 'force', 'si', 1],
  ['œrsted', 'Oe', null, 'magnetic_field_intensity', 'si', 79.5774715459477],
  ['ohm', 'Ω', null, 'electric_resistance', 'si', 1],
  ['ounce mass', 'ozm', null, 'mass', 'none', 0.028349523125],
  ['pascal', 'Pa', ['p'], 'pressure', 'si', 1],
  ['pferdestärke', 'PS', null, 'power', 'none', 735.49875],
  ['phot', 'ph', null, 'illuminance', 'none', 0.0001],
  ['pica (1/6 inch)', 'pica', null, 'length', 'none', 0.004233333333333334],
  ['pica (1/72 inch)', 'Pica', ['Picapt'], 'length', 'none', 0.0003527777777777778],
  ['poise', 'P', null, 'dynamic_viscosity', 'si', 0.1],
  ['pond', 'pond', null, 'force', 'si', 0.00980665],
  ['pound force', 'lbf', null, 'force', 'none', 4.4482216152605005],
  ['pound mass', 'lbm', null, 'mass', 'none', 0.45359237],
  ['pound per square inch', 'psi', null, 'pressure', 'none', 6894.757293168362],
  ['quart', 'qt', null, 'volume', 'none', 0.0009463529459999999],
  ['radian', 'rad', null, 'angle', 'si', 1],
  ['second', 's', ['sec'], 'time', 'si', 1],
  ['short hundredweight', 'cwt', ['shweight'], 'mass', 'none', 45.359237],
  ['siemens', 'S', null, 'electrical_conductance', 'si', 1],
  ['sievert', 'Sv', null, 'equivalent_dose', 'si', 1],
  ['slug', 'sg', null, 'mass', 'none', 14.593902937206364],
  ['square ångström', 'ang2', ['ang^2'], 'area', 'si', 1e-20, 2],
  ['square foot', 'ft2', ['ft^2'], 'area', 'none', 0.09290304],
  ['square inch', 'in2', ['in^2'], 'area', 'none', 0.00064516],
  ['square light-year', 'ly2', ['ly^2'], 'area', 'none', 8.95054210748189e+31],
  ['square meter', 'm2', ['m^2'], 'area', 'si', 1, 2],
  ['square mile', 'mi2', ['mi^2'], 'area', 'none', 2589988.110336],
  ['square nautical mile', 'Nmi2', ['Nmi^2'], 'area', 'none', 3429904],
  ['square Pica', 'Pica2', ['Picapt2', 'Pica^2', 'Picapt^2'], 'area', 'none', 1.2445216049382715e-7],
  ['square yard', 'yd2', ['yd^2'], 'area', 'none', 0.83612736],
  ['statute mile', 'mi', null, 'length', 'none', 1609.344],
  ['steradian', 'sr', null, 'solid_angle', 'si', 1],
  ['stilb', 'sb', null, 'luminance', 'si', 0.0001],
  ['stokes', 'St', null, 'kinematic_viscosity', 'si', 0.0001],
  ['stone', 'stone', null, 'mass', 'none', 6.35029318],
  ['tablespoon', 'tbs', null, 'volume', 'none', 0.000014786764781249999],
  ['teaspoon', 'tsp', null, 'volume', 'none', 0.00000492892159375],
  ['tesla', 'T', null, 'magnetic_flux_density', 'si', 1],
  ['thermodynamic calorie', 'c', null, 'energy', 'si', 4.184],
  ['ton', 'ton', null, 'mass', 'none', 907.18474],
  ['tonne', 't', null, 'mass', 'si', 1000],
  ['torr', 'Torr', null, 'pressure', 'none', 133.32236842105263],
  ['U.K. pint', 'uk_pt', null, 'volume', 'si', 0.00056826125],
  ['U.S. bushel', 'bushel', null, 'volume', 'none', 0.03523907016688],
  ['U.S. oil barrel', 'barrel', null, 'volume', 'none', 0.158987294928],
  ['U.S. pint', 'pt', ['us_pt'], 'volume', 'none', 0.00047317647299999996],
  ['U.S. survey mile', 'survey_mi', null, 'length', 'none', 1609.3472186944373],
  ['U.S. survey/statute acre', 'us_acre', null, 'area', 'none', 4046.8726098742522],
  ['volt', 'V', null, 'voltage', 'si', 1],
  ['watt', 'W', ['w'], 'power', 'si', 1],
  ['watt-hour', 'Wh', ['wh'], 'energy', 'si', 3600],
  ['weber', 'Wb', null, 'magnetic_flux', 'si', 1],
  ['yard', 'yd', null, 'length', 'none', 0.9144],
  ['year', 'yr', null, 'time', 'none', 31557600],
  ['degrees Celsius', 'C', ['cel'], 'temperature', 'none', 1],
  ['degrees Fahrenheit', 'F', ['fah'], 'temperature', 'none', 1],
  ['degrees Rankine', 'Rank', null, 'temperature', 'none', 1],
  ['degrees Reaumur', 'Reau', null, 'temperature', 'none', 1]
];

/** Each symbol to its unit. */
const unitsBySymbol: ReadonlyMap<string, Unit> = (() => {
  const map = new Map<string, Unit>();
  for (const unit of units) {
    map.set(unit[1], unit);
    for (const alternate of unit[2] ?? []) map.set(alternate, unit);
  }
  return map;
})();

/** SI prefixes, as powers of ten. `da` and `e` are both deka. */
const siPrefixes: Readonly<Record<string, number>> = {
  Y: 24, Z: 21, E: 18, P: 15, T: 12, G: 9, M: 6, k: 3, h: 2, da: 1, e: 1,
  d: -1, c: -2, m: -3, u: -6, n: -9, p: -12, f: -15, a: -18, z: -21, y: -24
};

/** Binary prefixes, as powers of two. */
const binaryPrefixes: Readonly<Record<string, number>> = {
  Yi: 80, Zi: 70, Ei: 60, Pi: 50, Ti: 40, Gi: 30, Mi: 20, ki: 10
};

/**
 * A unit spelling read as a unit and the prefix multiplier in front of it, or `null`.
 *
 * @remarks
 * A whole symbol wins over a prefixed reading, so `Pa` is the pascal and never peta-annum. A prefix
 * only reads when its unit takes that kind, and it is raised to the unit's power.
 */
function readUnitSpelling(text: string): { unit: Unit, multiplier: number } | null {
  const exact = unitsBySymbol.get(text);
  if (exact) return { unit: exact, multiplier: 1 };

  const binary = binaryPrefixes[text.slice(0, 2)];
  if (binary !== undefined) {
    const unit = unitsBySymbol.get(text.slice(2));
    if (unit?.[4] === 'si+binary') return { unit, multiplier: 2 ** binary };
  }

  for (const prefix of [text.slice(0, 2), text.slice(0, 1)]) {
    const exponent = siPrefixes[prefix];
    if (exponent === undefined) continue;
    const unit = unitsBySymbol.get(text.slice(prefix.length));
    // `Number('1e-3')`, not `10 ** -3`: the literal is the double nearest a thousandth.
    if (unit && unit[4] !== 'none') return { unit, multiplier: Number(`1e${exponent * (unit[6] ?? 1)}`) };
  }
  return null;
}
