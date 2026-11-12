
/** Reads A1 and logs its value. */
export default function main(ctx: SheetXL.IScript.ScriptContext): void {
  const value = ctx.wb.getWorksheet().getRange('A1').getValue();
  ctx.log(`A1 = ${value}`);
}