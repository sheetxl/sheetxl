/* cspell: disable */

/**
 * @hidden Unimplemented
 * @summary Returns a key performance indicator (KPI) property and displays the KPI name in the cell.
 * @param connection is the name of a connection to an OLAP cube
 * @param kpiName is the KPI name
 * @param kpiProperty is the KPI property
 * @param caption is the caption to be displayed in the cell
 */
export function CUBEKPIMEMBER(
  connection: string,
  kpiName: string,
  kpiProperty: number, // option 1-6
  caption?: string
): Promise<string> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns a member or tuple from the cube.
 * @param connection is the name of a connection to an OLAP cube
 * @param memberExpression is the expression representing the name of a member or tuple in the OLAP cube
 * @param caption is the caption to be displayed in the cell
 */
export function CUBEMEMBER(
  connection: string,
  memberExpression: string,
  caption?: string
): Promise<string> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the value of a member property from the cube.
 * @param connection is the name of a connection to an OLAP cube
 * @param memberExpression is the expression representing the name of a member in the OLAP cube
 * @param kpiProperty is the property name
 */
export function CUBEMEMBERPROPERTY(
  connection: string,
  memberExpression: string,
  kpiProperty: number, // option 1-6
): Promise<string> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the nth, or ranked, member in a set.
 * @param connection is the name of a connection to an OLAP cube
 * @param setExpression is the set from which the element is to be retrieved
 * @param rank is the rank of the element to be retrieved
 * @param caption is the caption to be displayed in the cell
 */
export function CUBERANKEDMEMBER(
  connection: string,
  setExpression: string,
  rank: number, // 1 - 5
  caption?: string
): Promise<string> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Defines a calculated set of members or tuples by sending a set expression to the cube on the server, which creates the set, and then returns that set to Microsoft Excel.
 * @param connection is the name of a connection to an OLAP cube
 * @param setExpression is the expression for the set
 * @param caption is the caption to be displayed in the cell
 * @param sortOrder is the sort order
 * @param sortBy is the sort by
 *
 * @remarks
 * https://support.office.com/client/results?authtype=unknown&lcid=1033&locale=en-us&microsoftapplicationstelemetrydeviceid=70192ff8-de17-4a6b-8e59-35903120b479&ns=EXCEL&syslcid=1033&uilcid=1033&version=90&helpid=xlmain11.chm60526
 */
export function CUBESET(
  connection: string,
  setExpression: string,
  caption?: string,
  sortOrder?: number, // 1 - 6
  sortBy?: string // memberExpression
): Promise<string> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the number of items in a set.
 * @param set is the set whose elements are to be counted
 */
export function CUBESETCOUNT(set: string): Promise<number> {
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns an aggregated value from the cube.
 * @param connection is the name of a connection to an OLAP cube
 * @param memberExpression
 */
export function CUBEVALUE(
  connection: string,
  ...memberExpression: string[]
): Promise<string> {
  return undefined;
}