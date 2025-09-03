import { FormulaError } from '@sheetxl/primitives';

// TODO - promote to somewhere elsewhere. Rationalize with the ICellRange.find
export const WildCard = {
  /**
   * @param {string|*} obj
   * @returns {*}
   */
  isWildCard: (obj: any): boolean => {
    if (typeof obj === "string")
      return /[*?]/.test(obj);
    return false;
  },

  toRegex: (lookupText: string, flags?: any): RegExp => {
    return RegExp(lookupText.replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape the special char for js regex
      .replace(/([^~]??)[?]/g, '$1.') // ? => .
      .replace(/([^~]??)[*]/g, '$1.*') // * => .*
      .replace(/~([?*])/g, '$1'), flags); // ~* => * and ~? => ?
  }
};

// TODO - promote to somewhere elsewhere.
export const Criteria = {
  /**
   * Parse criteria, support comparison and wild card match.
   *
   * @param {string|number} criteria
   * @returns {{op: string, value: string|number|boolean|RegExp, match: boolean|undefined}} - The parsed criteria.
   */
  parse: (criteria: any): { op: string, value: any, match?: boolean } => {
    const type = typeof criteria;
    if (type === "string") {
      // criteria = 'TRUE' or 'FALSE'
      const upper = criteria.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        // excel boolean
        return { op: '=', value: upper === 'TRUE' };
      }

      const res = criteria.match(/(<>|>=|<=|>|<|=)(.*)/);
      // is comparison
      if (res) {
        // [">10", ">", "10", index: 0, input: ">10", groups: undefined]
        let op = res[1];
        let value: any;

        // string or boolean or error
        if (isNaN(res[2])) {
          const upper = res[2].toUpperCase();
          if (upper === 'TRUE' || upper === 'FALSE') {
            // excel boolean
            value = upper === 'TRUE';
            // TODO - doesn't include all errors as regex to FormulaError
          } else if (/#NULL!|#DIV\/0!|#FIELD!|#VALUE!|#NAME\?|#NUM!|#N\/A|#REF!/.test(res[2])) {
            // formula error
            value = FormulaError.getBuiltInByLabel(res[2]);
          } else {
            // string, can be wildcard
            value = res[2];
            if (WildCard.isWildCard(value)) {
              return { op: 'wc', value: WildCard.toRegex(value), match: op === '=' }
            }
          }
        } else {
          // number
          value = Number(res[2])
        }
        return { op, value };

      } else if (WildCard.isWildCard(criteria)) {
        return { op: 'wc', value: WildCard.toRegex(criteria), match: true }
      } else {
        return { op: '=', value: criteria }
      }
    } else if (type === "boolean" || type === 'number' || (Array.isArray(criteria)
      || criteria instanceof FormulaError.Known)) {
      return { op: '=', value: criteria }
    } else {
      throw Error(`Criteria.parse: type ${typeof criteria} not support`)
    }
  }
};