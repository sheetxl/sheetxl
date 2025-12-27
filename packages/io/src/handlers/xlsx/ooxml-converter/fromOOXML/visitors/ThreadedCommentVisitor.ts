import type { IComment } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import * as NumberUtils from '../NumberUtils';
import { removeCurlyBraces } from '../../UtilsOOXML';

/**
 * https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/adb84732-9fc8-48b6-bddc-6b0bcdaad940
 */
export class ThreadedCommentVisitor implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonParent: IComment.JSON[]): IComment.JSON {
    if (!elem) return;

    const comment:IComment.JSON = {} as IComment.JSON;
    context.copyFromAttribute(elem, "id", comment, "id", removeCurlyBraces);
    context.copyFromAttribute(elem, "personId", comment, "personId", removeCurlyBraces);
    context.copyFromAttribute(elem, "ref", comment);

    // const textElement:Element = context.evaluate("text", elem) as Element;
    // const firstChild = textElement?.firstChild
    // if (firstChild && firstChild.nodeType === 3) // 3 - Node.TEXT_NODE
    //   comment.text = firstChild.textContent;


    context.copyFromAttribute(elem, "parentId", comment, "parentId", removeCurlyBraces);

    // DateTime as ISO
    context.copyFromAttribute(elem, "dT", comment);

    // From persons

    if (elem.hasAttribute("done")) {
      comment.done = NumberUtils.parseAsBoolean(elem.getAttribute("done"));
    }

    // TODO - also supports hyperlinks and mentions

    jsonParent.push(comment);
    return comment;

    /*
      <xsd:sequence>
        <xsd:element name="text" type="x:ST_Xstring" minOccurs="0" maxOccurs="1"/>
        <xsd:element name="mentions" type="CT_ThreadedCommentMentions" minOccurs="0" maxOccurs="1"/>
        <xsd:element name="extLst" minOccurs="0" maxOccurs="1"/>
      </xsd:sequence>
     */

    /*
      Another type
     <xsd:complexType name="CT_Mention">
      <xsd:attribute name="mentionpersonId" type="x:ST_Guid" use="required"/>
      <xsd:attribute name="mentionId" type="x:ST_Guid" use="required"/>
      <xsd:attribute name="startIndex" type="xsd:unsignedInt" use="required"/>
      <xsd:attribute name="length" type="xsd:unsignedInt" use="required"/>
      </xsd:complexType>
   */
  }
}
