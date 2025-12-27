import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { IComment } from '@sheetxl/sdk';
export class CommentVisitor implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonParent: any): any/*text json*/ {
    if (!elem) return;

    const comment:IComment.JSON = {} as IComment.JSON;
    context.copyFromAttribute(elem, "ref", comment);
    context.copyFromAttribute(elem, "authorId", comment, "authorId", context.INT_COPY);
    // TODO - merge this with as shapeId?
    comment.asNote = true;
    // legacy shape id. Not used, not supported (vml?)
    // context.copyFromAttribute(elem, "shapeId", comment, "shapeId", context.INT_COPY);

    if (!jsonParent.comments) {
      jsonParent.comments = [];
    }
    jsonParent.comments.push(comment);
    // const content:any = {};
    // comment.content = content;
    return comment;
  }

}
