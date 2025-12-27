import type { IComment, ISheet } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class ThreadedCommentsVisitor implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonParent: ISheet.JSON): IComment.JSON[] {
    if (!elem) return;

    const comments:IComment.JSON[] = [];
    jsonParent.comments = comments;
    return comments;
  }
}
