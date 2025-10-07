import { CommonUtils } from '@sheetxl/utils';

import { LicenseManager, type IWorkbook, type ISheet, type ICellRange, type ICellRanges } from '@sheetxl/sdk';
import { type IWorkbookElement } from './IWorkbookElement';


let _examplesPrinted = false;
let _forcePrintExamples = false;
const printExamples = () => {
  // const TEXT_TIP_SCRIPTING = `${scriptEditorUrl}`;
  // const TEXT_TIP = `%cTip: You can script directly in the application.\nTry> %c${TEXT_TIP_SCRIPTING}\n>`;
  // CommonUtils.consoleWithNoSource(`${TEXT_TIP}`,
  //   'color:#ffa726;',
  //   'font-family:monospace;color:#1976d2;font-size:12px;',
  //   // 'font-family:monospace;',
  //   // 'font-family:monospace;color:#1976d2;font-size:12px;',
  //   // 'font-family:monospace;',
  // );

  const TEXT_TIP_EXAMPLE = `SheetXL.getRange('b2:c3').setValues([[42, 'Hello Word'], [new Date(), true]])`;
  const TEXT_TIP_EXAMPLE_MORE = `SheetXL.moreExamples()`;
  const TEXT_TIP = `%cTip: You can access the API directly in the console.\nTry\n%c>%c ${TEXT_TIP_EXAMPLE} %c\n>%c ${TEXT_TIP_EXAMPLE_MORE}`;
  CommonUtils.consoleWithNoSource(`${TEXT_TIP}`,
    'color:#ffa726;',
    'font-family:monospace;color:#1976d2;font-size:12px;',
    'font-family:monospace;',
    'font-family:monospace;color:#1976d2;font-size:12px;',
    'font-family:monospace;',
  );
  _examplesPrinted = true;
  const link = document.getElementById('openEditorLink');
  if (link) {
    link.addEventListener('click', (event) => {
      event.preventDefault(); // Prevent default link behavior
      console.log('openScriptEditor called from console');
      // openScriptEditor(); // Call your app's function
    });
  }
}


// Note - Currently this doesn't support unloading and having multiple workbooks. Create a stack of workbooks with useEffect)
let activeIWorkbookElement:IWorkbookElement = null;
export const setGlobalIWorkbookElement = async (workbookElement: IWorkbookElement) => {
  const ld = await LicenseManager.getDetails();
  const shouldPrint = __DEV__ || _forcePrintExamples || ld.isEval();
  if (!shouldPrint) return;

  // create a global variable to access SheetXL vars
  try {
    // @ts-ignore
    /*eslint no-restricted-globals: ["off"]*/
    const global = top ?? window as any; // globalthis
    if (!global.SheetXL) {
      global.SheetXL = Object.freeze({
        getSelectedWorkbook: (): IWorkbook => activeIWorkbookElement?.getWorkbook(),
        getSelectedSheet: (): ISheet => activeIWorkbookElement?.getWorkbook().getSelectedSheet(),
        getSelectedRange: (): ICellRange => activeIWorkbookElement?.getWorkbook().getSelectedRange(),
        getSelectedRanges: (): ICellRanges => activeIWorkbookElement?.getWorkbook().getSelectedRanges(),
        getRange: (address: ICellRange.Address): ICellRange => activeIWorkbookElement?.getWorkbook().getRange(address),
        getSelectedWorkbookElement: (): IWorkbookElement => activeIWorkbookElement,
        getLicenseManager: () => LicenseManager,
        moreExamples: () => {
          const examples = {
            [`SheetXL.getRange('Sheet1!e5:f6').setValues([[110, 220], [210, 220]])`]: { [`Summary`]: `Set an array of values.`},
            [`SheetXL.getRange('a1:e5').setValue(100)`]: { [`Summary`]: `Set a single repeating value to a range.`},
            [`SheetXL.getRange('Sheet1!e5:f6').getValues()`]: { [`Summary`]: `Get the values as a 2d array (see forEach).`},

            [`SheetXL.getSelectedRange().setValue(new Date())`]: { [`Summary`]: `Set current date/time using Javascript Date.`},
            [`SheetXL.getSelectedRange().setValue('10/23/95')`]: { [`Summary`]: `Set current date/time using string.`},

            [`SheetXL.getSelectedSheet().getUsedRange().getValues()`]: { [`Summary`]: `Get all of the values in a sheet.`},
            [`SheetXL.getSelectedRange().getStyle().update({ fill: 'accent4' })`]: { [`Summary`]: `Set fill to theme color 4.`},
            [`SheetXL.getRange('E:L').getStyle().update({ fill: 'accent1 lumMod 90 lumOff 40' })`]: { [`Summary`]: `Set some columns to a modified theme color.`},
            [`SheetXL.getRange('e5:f10').getStyle().update({ style: { border: 'double blue' }})`]: { [`Summary`]: `Set border.`},
            [`SheetXL.getCell().getStyle().fill.toCSS()`]: { [`Summary`]: `Get the fill style as css for the selected cell.`},
            [`SheetXL.getRange('a1:a3').autoFill('a1:a7')`]: { [`Summary`]: `Autofill down.`},
            [`SheetXL.getRange('e7:i9').merge({ orientation: 'rows' })`]: { [`Summary`]: `Merge cells horizontally.`},
            [`SheetXL.getSelectedRange().sort({ ascending: false, hasHeader: false })`]: { [`Summary`]: `Sort selected cells ascending with a header.`},
            [`SheetXL.getSelectedRange().clear('all')`]: { [`Summary`]: `Clear the current range a different way.`},
            [`SheetXL.getSelectedSheet().getTables().add('b2:e9')`]: { [`Summary`]: `Create a 4x8 table at b2 for current sheet.`},
            [`SheetXL.getRange('a1:c3').copyFrom('e1:g3')`]: { [`Summary`]: `Copy cells.`},
            [`SheetXL.getRange('c:t').getColumnHeaders().setSize(30)`]: { [`Summary`]: `Set the size of columns to 30 pixels.`},
            [`SheetXL.getRange('2:3').delete()`]: { [`Summary`]: `Remove rows 2 and 3 and shift up.`},

            [`SheetXL.getSelectedSheet().getMovables().addImage('https://www.sheetxl.com/logo-text.svg')`]: { [`Summary`]: `Add an image.`},
            [`SheetXL.getSelectedSheet().getMovables().addImage('https://www.sheetxl.com/logo-text.svg', { bounds: { height: 100 } })`]: { [`Summary`]: `Add an image of height 100.`},

            [`SheetXL.getSelectedRange().doBatch(() => { SheetXL.getSelectedRange().setValue(1.50).getStyle().update({ numberFormat: '0%' }).autoFit(); }, 'Enter 150%')`]: { [`Summary`]: `Set value to 100 and numberformat to 0% as a single.`},
            [`SheetXL.getSelectedRange().doBatch(() => { SheetXL.getSelectedRange().setValue('Remind Me Later').getStyle().update({ namedStyle: 'Note'}).autoFit(); }, 'Set Reminder')`]: { [`Summary`]: `Set a value and style to Note style and autofit text.`},

            [`SheetXL.getSelectedWorkbook().getNames().addReference('Small_Range', 'A2:E5');`]: { [`Summary`]: `Add a named range.`},
            [`SheetXL.getSelectedWorkbook().getRange('a1:e5').addListener((e) => { console.log('got an update for:', e.getSource().toString()) })`]: { [`Summary`]: `Listen for updates at a range.`},
          };
          console.table(examples);
        }
      });
    }
  } catch (error: any) {
    // if in cross origin iframe (like some some embedded applications) this will fail
    if (!(error instanceof DOMException))
      console.error(error);
    _examplesPrinted = true; // or at least we tried to
  }

  if (activeIWorkbookElement === workbookElement) return;
  activeIWorkbookElement = workbookElement;
  if (_examplesPrinted) return;
  try {
    _examplesPrinted = true;
    // @ts-ignore
    const global = top ?? window as any; // globalthis
    if (global.SheetXL) {
      // after the license is loaded we want to show some examples in console
      await (LicenseManager as any)._validate(true);
      if (LicenseManager.wasPrinted()) {
        printExamples();
      }
    }
  } catch (error: any) {
    if (!(error instanceof DOMException))
      console.error(error);
  }
}

/**
 * By default we will print examples message if dev and eval only
 *
 * @param forcePrintExamples
 */
export const setPrintExamplesOnLoad = (forcePrintExamples: boolean) => {
  _forcePrintExamples = forcePrintExamples;
}