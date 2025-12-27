// import type * as XLSXTypes from 'xlsx/types'; // TODO - add back

import { CommonUtils, ExpectedError } from '@sheetxl/utils';

import {
  Workbook, IWorkbook, Theme, ISheet, IStyleCollection, ResourceCollection, IResource, IStyle,
  StyleCollection, IComment, OutOfBoundsError, JSONStableStringify
} from '@sheetxl/sdk';

import { SaxParser } from '../../sax';

import {
  parseRels, readAsJSON, readAsBinary, readAsJSONs, resolveRelatives,
  arrayBufferToStringStream, removeCurlyBraces
} from './ooxml-converter/UtilsOOXML';
import type { ConvertFromOptions } from './ooxml-converter/OOXMLTypes';

import { createSheetSaxVisitor } from './ooxml-converter/fromOOXML/saxVisitors/SheetVisitor';

import type { ReadXLSXOptions } from './Types';

// import { extractVBACode } from './vba';

interface DOMParser {
  parseFromString(xmlSource: string, mimeType?: string): Document;
}

/**
 * Creates a new workbook with values imported from an XLSX.
 *
 * @param buffer The ArrayBuffer to import.
 * @param options Import options.
 * @returns A Promise for an IWorkbook
 */
export const readBuffer = async (
  buffer: ArrayBuffer,
  options?: ReadXLSXOptions
): Promise<IWorkbook> => {
  const {
    password,
    createWorkbookOptions: optionsWB = {},
    ...rest
  } = options ?? {};

  const warnings: [message: string, context: string][] = [];
  const taskProgress = options?.progress;

  const onProgress = taskProgress?.onProgress;
  let amountProgress = 0;

  /* the io package is generally loaded dynamically so prefetch here has limited use. */
  const importXlsx = import(/* webpackChunkName: "xlsx", webpackPrefetch: true */ 'xlsx'); //
  const importFromOOXMLConverter = import(/* webpackChunkName: "ooxml-sxl-converter", webpackPrefetch: true */ './ooxml-converter/FromOOXMLConverter');

  // We only load the DomParser not currently defined (we are not in a browser context)
  let nativeParser:DOMParser = null;
  try {
    nativeParser = new DOMParser();
  } catch (error: any) {
    // console.warn('DOMParser', error);
  }
  let importDOMParser = null;
  if (!nativeParser) {
    importDOMParser = import(/* webpackChunkName: "xmldom-xmldom" */'@xmldom/xmldom'); // , webpackPrefetch: true
  }

  let XLSX:any = null;
  let moduleFromOOXML:any = null;
  let moduleDomParser:any = null;
  try {
    const libraries = await Promise.all([
      importXlsx,
      importFromOOXMLConverter,
      importDOMParser,
    ]);
    XLSX = libraries[0];
    moduleFromOOXML = libraries[1];
    moduleDomParser = libraries[2];
  } catch (error: any) {
    throw new Error('Unable to load XLSX parser.', { cause: error })
  }

  try {
    // XLSX.CFB.read;
    // console.profile("Import Excel");
    // console.time("Import Excel");
    const xlsxWB = XLSX.read(buffer, {
      type: 'array',
      sheets: [], // prevent xlsx from processing sheets as we do this ourselves
      cellStyles: false, // generate styles
      bookFiles: true, // add raw files to book object
      // password, // pass as option in above
    });

    if (!(xlsxWB as any).Directory) {
      throw new ExpectedError(`Unable to parse as an Excel document. Try to save as '.xlsx' and try again.`);
    }
    // (xlsxWB as any).Directory['richtypes'] = ['/xl/richData/rdrichvaluestructureTypes.xml']; // not in use yet
    (xlsxWB as any).Directory['richstructure'] = ['/xl/richData/rdrichvaluestructure.xml'];
    (xlsxWB as any).Directory['richdata'] = ['/xl/richData/rdrichvalue.xml'];

    const fromOOXMLConverter = new moduleFromOOXML.FromOOXMLConverter();
    const domParser = nativeParser ?? new moduleDomParser.DOMParser();

    // TODO - not able to get this to work.
    // const vbaProject = (xlsxWB as any).files['xl/vbaProject.bin'];
    // if (vbaProject) {
    //   try {
    //     const vbaCode = extractVBACode(XLSX, vbaProject);
    //     // TODO - save vbaCode
    //   } catch (error: any) {
    //     console.warn('Error extracting VBA code', error);
    //   }
    // }

    /*
      * We want to create shared resources directly and skip json marshalling
      */
    const resources = optionsWB?.resources ?? new ResourceCollection();
    const persistResource = resources.beginPersist();
    // TODO - if resources were passed in use this
    const refKey = {};
    const setRes = new Set<IResource>();
    // const optionsWBOverrides2:XLSXImportOptions = {
    //   ...optionsWB
    // };

    const paramMap = new Map<string, any>();
    paramMap.set("richTypes", [])

    const _parsedRefs:Map<string, any> = new Map();
    const asSyncs:Promise<void>[] = [];

    const getXLSXFile = (loc: string) => (xlsxWB as any).files[loc];
    const getRefs = (refLocation: string, parsedRefs: Map<string, any>): Map<string, any> => {
      const lastSep = refLocation.lastIndexOf('/');
      const relPath = refLocation.substring(0, lastSep + 1);
      const relFile = refLocation.substring(lastSep + 1, refLocation.length);
      const relLocation = relPath + '_rels/' + relFile + '.rels';

      let relsMap = parsedRefs.get(relLocation);
      if (!relsMap) {
        relsMap = parseRels(relLocation, getXLSXFile, domParser, fromOOXMLConverter, optionsConvert);
        parsedRefs.set(relLocation, relsMap);
      }
      return relsMap;
    };

    const getRef = (relId: string, refLocation: string, asBinary: boolean, parsedRefs: Map<string, any>=_parsedRefs): any => {
      const relsMap = getRefs(refLocation, parsedRefs);
      let relTarget = relsMap.get(relId);
      let pathTarget = relTarget?.target;
      if (!pathTarget) {
        return null;
      }
      if (relTarget.targetMode === 'External') {
        return relTarget.target;
      }

      const lastSep = refLocation.lastIndexOf('/');
      const relPath = refLocation.substring(0, lastSep + 1);
      if (!pathTarget.startsWith('/'))
        pathTarget = relPath + pathTarget;
      pathTarget = resolveRelatives(pathTarget);

      /* Used for conditional formatting, data validation, and sorting */
      const mapDxfs:Map<number, any> = fromOOXMLConverter?.getVisitorParamsState().get('dxfs');

      let ref = parsedRefs.get(pathTarget);
      if (!ref) {
        // TODO - add to sax/dom map somewhere
        const saxSheet = `http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet`;
        if (relTarget.type === saxSheet) {
          const sheetJSON: ISheet.JSON = {};
          ref = sheetJSON;
          const readSheet = async (): Promise<any> => {
            const eventHandler:SaxParser.EventHandler = createSheetSaxVisitor(sheetJSON,
              (relId: string, asBinary: boolean=false): any => {
                return getRef(relId, pathTarget, asBinary) ?? null;
              },
              addSharedString,
              mapDxfs,
              () => {
              // console.log('read end');
              },
              (message: string, context?: string): void => {
                context = context ? `${context} (${pathTarget})` : pathTarget;
                warnings.push([message, context]);
              },
              (amount: number): void =>{
                amountProgress = amountProgress + amount;
                onProgress?.(amountProgress);
              },
              paramMap
            );
            const asArray = readAsBinary(pathTarget, getXLSXFile);
            const asReader = await arrayBufferToStringStream(asArray);
            try {
              await SaxParser.parseStream(asReader, eventHandler, {
                xmlns: false
              });
            } catch (error: any) {
              console.warn(`Error parsing sheet: '${pathTarget}'`, error);
              throw new Error(`Error parsing sheet: '${pathTarget}'`, { cause: error });
            }

            const relsSheetMap = getRefs(pathTarget, parsedRefs);
            let threadedComments:IComment.JSON[];
            let mapThreadedComments = new Map<string, IComment.JSON>();
            if (relsSheetMap) {
              const relThreadedComments = `http://schemas.microsoft.com/office/2017/10/relationships/threadedComment`;
              relsSheetMap.forEach((rel, relId) => {
                if (rel.type === relThreadedComments) {
                  const jsonComments = getRef(relId, pathTarget, false, parsedRefs);
                  threadedComments = jsonComments?.comments;
                  if (threadedComments) {
                    threadedComments.forEach((comment) => {
                      mapThreadedComments.set(comment.id, comment);
                    });
                  }
                }
              });

              let noteComments:any; // Not in the correct format
              // look for comments. These have implicit references via the rels
              const relComment = `http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments`;
              relsSheetMap.forEach((rel, relId) => {
                if (rel.type === relComment) {
                  const jsonComments = getRef(relId, pathTarget, false, parsedRefs);
                  // TODO - author ids? - This will map to persons record. (person will have id and display)
                  // TODO - simple util to convert runs to a single string for now. (runs will map to slate.js)
                  noteComments = jsonComments;
                }
              });
              if (noteComments || threadedComments) {
                const mergedComments = threadedComments ?? [];
                // notes are not in the correct format. We need to convert them.
                const asNote = noteComments?.comments;
                if (asNote) {
                  const authors = noteComments?.authors;
                  const asNoteLength = asNote.length;
                  for (let i=0; i<asNoteLength; i++) {
                    const note = asNote[i];
                    if (!note) continue;
                    let personId = authors && note.authorId !== undefined ? authors[note.authorId] : note.authorId;
                    // skip if author is a threadedComment then remove the backward hack
                    if (personId && personId.startsWith('tc=')) {
                      personId = removeCurlyBraces(personId.substring(3));
                      if (mapThreadedComments.has(personId)) {
                        continue;
                      }
                    }

                    let personFound:IComment.PersonJSON = null;
                    if (personId) {
                      personFound = mapPersonsById.get(personId);
                    }
                    if (!personFound) {
                      personFound = mapPersonsByDisplay.get(personId);
                    }
                    if (!personFound) {
                      personFound = {
                        id: CommonUtils.uuidV4(),
                        displayName: personId
                      }
                      mapPersonsByDisplay.set(personFound.displayName, personFound);
                      mapPersonsById.set(personFound.id, personFound);
                    }
                    personId = personFound?.id ?? null;

                    const asComment:IComment.JSON = {
                      id: CommonUtils.uuidV4(),
                      personId,
                      ref: note.ref,
                      // dt: note.dt,
                      done: false,
                      asNote: true,
                      content: note.content
                    };
                    mergedComments.push(asComment)
                  }
                }
                sheetJSON.comments = mergedComments;
              }
            }
          }
          asSyncs.push(readSheet());
        } else if (asBinary) {
          ref = readAsBinary(pathTarget, getXLSXFile, (buffer: ArrayBuffer) => {
            const asResource = resources.add({
              buffer
            });
            asResource.addReference(refKey);
            setRes.add(asResource);
            return persistResource.toResourceId(asResource);
          }, optionsConvert);
        } else {
          ref = readAsJSON(pathTarget, getXLSXFile, domParser, fromOOXMLConverter, optionsConvert);
        }
      }
      return ref;
    };

    // TODO - use PersonCollection
    const addPerson = (_person: any): string => {
      return null;
    }

    /* Because Excel may have empty styles that we auto-prune we need to prune these and the style offsets from the sheets */
    const optionsConvert:ConvertFromOptions = {
      paramMap,
      getRefs,
      getRef,
      parsedRefs: _parsedRefs,
      addPerson
    };

    /* Because Excel may have empty styles that we auto-prune we need to prune these and the style offsets from the sheets */
    // TODO - just parse this ourselves so that we can get the richtext
    const strings:string[] = [];
    let stringLength = 0;
    if ((xlsxWB as any).Strings) {
      stringLength = parseInt((xlsxWB as any).Strings.Unique ?? (xlsxWB as any).Strings.length ?? 0);
    }
    const parseStrings:any[] = (xlsxWB as any).Strings ?? [];
    for (let i=0;i<stringLength; i++) {
      strings.push(parseStrings[i]?.t ?? '');
    }
    // seems to be adding an extra blank string. remove it.
    // paramMap.set('sharedStrings', (index: number) => {
    //   return (xlsxWB as any).Strings?.[index]?.t ?? null;
    // });

    // This is just for inline strings
    const mapSharedString:Map<string, number> = new Map();
    let nextId:number = stringLength;//parseInt((xlsxWB as any).Strings?.Count) ?? 0;
    const addSharedString = (text: string): number => {
      const idFound:number = mapSharedString.get(text);
      if (idFound !== undefined) return idFound;
      const retValue = nextId;
      mapSharedString.set(text, nextId++);
      strings.push(text);
      return retValue;
    }

    // we read these into paramMap for errors.
    // TODO - save to JSON
    const mapJSONRichDataStructure = readAsJSONs('richstructure', xlsxWB, domParser, fromOOXMLConverter, optionsConvert); // /xl/richData/rdrichvaluestructure.xml
    const mapJSONRichDataValues = readAsJSONs('richdata', xlsxWB, domParser, fromOOXMLConverter, optionsConvert); // /xl/richData/rdrichvalue.xml

    const mapPersonsById = new Map<string, IComment.PersonJSON>();
    const mapPersonsByDisplay = new Map<string, IComment.PersonJSON>(); // case sensitive?
    const mapJSONPeople = readAsJSONs('people', xlsxWB, domParser, fromOOXMLConverter); // /xl/persons/person.xml
    let jsonPeople:IComment.PersonJSON[] = null;
    if (mapJSONPeople.size > 0) {
      jsonPeople = mapJSONPeople.entries().next()?.value?.[1]?.persons;
      if (jsonPeople) {
        const jsonPeopleLength = jsonPeople.length;
        for (let i=0; i<jsonPeopleLength; i++) {
          const person = jsonPeople[i];
          mapPersonsById.set(person.id, person);
          mapPersonsById.set(person.displayName, person);
        }
      }
    }

    const jsonThemes = readAsJSONs('themes', xlsxWB, domParser, fromOOXMLConverter, optionsConvert);
    let jsonTheme = null;
    if (jsonThemes && jsonThemes.entries) {
      let first = jsonThemes.entries().next();
      if (first?.value?.[1])
        jsonTheme = first.value[1];
    }

    const theme = new Theme(jsonTheme);

    /* before the workbooks and sheet. Must be first until we denormalize dxfs. */
    const jsonStylesEntries = readAsJSONs('styles', xlsxWB, domParser, fromOOXMLConverter, optionsConvert);
    /* Normalize the styles. We do this to reduce styles that match existing but not strictly required */
    let jsonStyles:IStyleCollection.JSON = jsonStylesEntries.entries().next()?.value[1];
    if (jsonStyles) {
      // Note - json styles objects are shared. So changing an object may cause the source to change.
      // We clone to avoid this.
      jsonStyles = JSON.parse(JSONStableStringify(jsonStyles));

      // TODO - determine preference for this
      // const normalize = false;
      // if (normalize) {
      //   // TODO - Should we move this normalization logic into Styles.fromJSON?
      //   const styles = new StyleCollection(theme, jsonStyles.indexedColors);
      //   const jsonNamed = jsonStyles.named;
      //   if (jsonNamed) {
      //     const jsonNamedLength = jsonNamed.length;
      //     for (let i=0; i<jsonNamedLength; i++) {
      //       const named = jsonNamed[i];
      //       // because normalize works against shared styles we add our name as a namedStyle and then remove it.
      //       const normalizedStyled = styles.normalize(named.style);
      //       const normalized:IStyle.NamedJSON = {
      //         ...named,
      //         style: normalizedStyled as any
      //       }
      //       jsonNamed[i] = normalized;
      //       styles.setNamed(normalized);
      //     }
      //   }
      //   const jsonDirect = jsonStyles?.direct;
      //   if (jsonDirect) {
      //     const jsonDirectLength = jsonDirect.length;
      //     for (let i=0; i<jsonDirectLength;i++) {
      //       jsonDirect[i] = styles.normalize(jsonDirect[i]) as any;
      //     }
      //   }
      // }
    }

    const jsonWorkbooks = readAsJSONs('workbooks', xlsxWB, domParser, fromOOXMLConverter, optionsConvert);
    await Promise.all(asSyncs);

    const jsonWorkbook = jsonWorkbooks.entries().next().value[1];
    const jsonWB:IWorkbook.JSON = {
      ...jsonWorkbook,
      styles: jsonStyles,
      theme: theme.toJSON()
    }

    if (strings.length > 0) {
      jsonWB.strings = strings;
    }

    if (jsonPeople && jsonPeople.length > 0) {
      jsonWB.people = jsonPeople;
    }
    // console.log('import from xlsx', jsonWB);
    const optionsCreateWB:IWorkbook.ConstructorOptions = {
      ...optionsWB,
      resources,
      json: jsonWB,
    }
    const workbook:IWorkbook = new Workbook(optionsCreateWB);
    // now delete the refs. This is cumbersome.
    setRes.forEach((res: IResource) => {
      res.deleteReference(refKey);
    });
    persistResource.endPersist();

    // after done
    if (warnings.length) {
      const onWarning = taskProgress?.onWarning;
      if (onWarning) {
        for (const warn of warnings) {
          const [message, context] = warn;
          onWarning(message, context);
        }
      }
    }

    // console.profileEnd("Import Excel");
    // console.timeEnd("Import Excel");
    return workbook;
  } catch (error: any) {
    let message = 'Unable to parse XLSX.';
    if (error instanceof OutOfBoundsError) {
      message = 'Unable to open XLSX. There are too many rows or columns.';
    }
    throw new Error(message, { cause: error });
  }
}
