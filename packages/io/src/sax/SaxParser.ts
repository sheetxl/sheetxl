import {
  SaxesParser, SaxesStartTag, SaxesTag, SaxesAttribute, SaxesAttributeNS, SaxesOptions
}  from './Saxes';

export namespace SaxParser {

  export type StartTag = SaxesStartTag;

  export type Tag = SaxesTag;

  export type Attribute = SaxesAttribute;

  export type Attributes = Record<string, SaxesAttributeNS> | Record<string, string>;

  export const Events = {
    XmlDecl: "xmldecl",
    Text: "text",
    ProcessingInstruction: "processinginstruction",
    Doctype: "doctype",
    Comment: "comment",
    OpenTagStart: "opentagstart",
    Attribute: "attribute",
    OpenTag: "opentag",
    CloseTag: "closetag",
    CDdata: "cdata",
    Error: "error",
    End: "end",
    Ready: "ready"
  } as const;

  export type EventType = typeof Events[keyof typeof Events];

  export interface EventHandler<T=any> {
    onOpenTagStart?: (tag: SaxParser.StartTag) => void;
    onOpenTag?: (tag: SaxParser.StartTag) => void;
    onCloseTag?: (tag: SaxParser.Tag) => void;
    onAttribute?: (attribute: SaxParser.Attribute) => void;
    onText?: (text: string) => void;
    onError?: (error: any) => void;
    // comment?
    onEnd?: () => T;
  }

  // Streaming the string chunks to saxes parser
  export const parseStream = async <T=any>(reader: ReadableStreamDefaultReader<string>, handler: EventHandler, options?: SaxesOptions): Promise<T> => {
    const parser = new SaxesParser({
      position: false,
      ...options
    });

    if (handler.onOpenTagStart) {
      parser.on(SaxParser.Events.OpenTagStart, handler.onOpenTagStart);
    }
    if (handler.onOpenTag) {
      parser.on(SaxParser.Events.OpenTag, handler.onOpenTag);
    }
    if (handler.onCloseTag) {
      parser.on(SaxParser.Events.CloseTag, handler.onCloseTag);
    }
    if (handler.onAttribute) {
      parser.on(SaxParser.Events.Attribute, handler.onAttribute);
    }
    if (handler.onText) {
      parser.on(SaxParser.Events.Text, handler.onText);
    }
    if (handler.onError) {
      parser.on(SaxParser.Events.Error, handler.onError);
    }
    let retValue:T = undefined;
    if (handler.onEnd) {
      handler.onEnd
      const onEndCapture = (): void => {
        retValue = handler.onEnd();
      }
      parser.on(SaxParser.Events.End, onEndCapture);
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.write(value); // Write the string chunk to the SAX parser
    }

    parser.close();  // Signal the end of the stream to the parser
    return retValue;
  }
}