import { t } from '@sheetxl/utils';

import { type IWorkbook, type INamed, type ICalculation } from '@sheetxl/sdk';

/**
 * The `INamed.getType()` of the defined names the calculation engine owns.
 *
 * @remarks
 * Everything calc owns is a `'formula'` — a name that "is a range" is just one whose expression is
 * a pure reference. There is no separate reference type.
 */
export const NAMED_TYPE_FORMULA = 'formula';

/**
 * Whether a name can be redefined through this pane.
 *
 * @remarks
 * Only names the calculation engine owns. The others are *derived* — a table's `INamed` reports the
 * table's name and range, and nothing else names it. Editing one here would not do what it looks
 * like: `NamedTable` overrides `getName()` to delegate to the table but inherits `AbstractNamed`'s
 * `setName`, which writes to the wrapper's own state — so a "rename" would be written, be undoable,
 * and change nothing the user can see. Renaming a table belongs to the table.
 */
export const isEditableNamed = (item: INamed): boolean => item.getType() === NAMED_TYPE_FORMULA;

/**
 * The editor's working value for one name.
 *
 * @remarks
 * A plain object rather than a detached model, because there is no model to detach. An
 * `INamedCollection` is a pure aggregator over the registries that own the items, so it has no
 * `createItem` and nothing that could hold an uncommitted edit. {@link saveNamedDraft} is
 * what turns this back into model writes.
 */
export interface NamedDraft {
  name: string;
  /**
   * The "refers to" expression, with or without a leading `=` — the editor authors it WITH one (it is
   * a formula field), and {@link saveNamedDraft} normalizes it off before the model sees it.
   */
  expression: string;
  /** The sheet name this is scoped to, or `null` for workbook (global) scope. */
  scope: string | null;
  comment: string;
  hidden: boolean;
  /** {@link isEditableNamed} for the item this was taken from; `true` when adding. */
  readonly editable: boolean;
}

/**
 * The "refers to" text for a name.
 */
export const expressionOf = (item: INamed): string => {
  try {
    if (isEditableNamed(item)) {
      // A formula name's value IS its expression, normalized without the leading `=`.
      return String(item.getValue() ?? '');
    }
    return item.getRanges?.()?.toString() ?? '';
  } catch (error: any) {
    // An unresolvable name renders as blank rather than taking the list down with it.
    return '';
  }
};

/**
 * The selection, absolute and workbook-qualified — the seed for a new name.
 *
 * @remarks
 * Fixed because a name refers to a region that does not move relative to whoever reads it, and
 * resolved against the workbook so the address carries its sheet.
 */
const selectionExpression = (workbook: IWorkbook): string => {
  try {
    return workbook.getRanges(workbook.getWorksheet().getSelectedRange())
      .getFixed(true)
      .toString();
  } catch (error: any) {
    return '';
  }
};

/**
 * Builds the editor's working value — from an existing name, or seeded for a new one.
 */
export const createNamedDraft = (workbook: IWorkbook, template?: INamed): NamedDraft => {
  if (!template) {
    return {
      name: workbook.getNames().findValidName('Name'),
      expression: selectionExpression(workbook),
      scope: null,
      comment: '',
      hidden: false,
      editable: true
    };
  }
  return {
    name: template.getName(),
    expression: expressionOf(template),
    scope: template.getScope(),
    comment: template.getComment() ?? '',
    hidden: template.isHidden(),
    editable: isEditableNamed(template)
  };
};

/**
 * Applies a draft: defines a new name, or writes the changed fields of an existing one.
 *
 * @param target The name being edited, or `null` when adding.
 * @throws `Error` if the name is invalid or already taken — the panel surfaces it and keeps the
 * editor open.
 *
 * @remarks
 * Every edit is ONE undo entry. Each setter opens its own commit, so a rename plus a redefinition
 * would otherwise unwind a field at a time — and `setName` re-keys the item in the collection, so a
 * half-undone edit leaves the map keyed on something the item no longer carries.
 *
 * Changing the SCOPE is not a field write at all but a delete plus a define, for the reason given
 * at that branch; it is wrapped in its own commit to keep the same one-entry guarantee.
 */
export const saveNamedDraft = (
  workbook: IWorkbook,
  draft: NamedDraft,
  target: INamed | null
): void => {
  const name = draft.name.trim();
  // The EDITOR shows a formula (`=Sheet1!$A$1`); the model stores the expression itself, which is what
  // `expressionOf` reads back and what the "did it change?" comparison below is against. Normalizing
  // here — rather than at the field — keeps that model contract untouched whichever form is authored.
  const expression = draft.expression.trim().replace(/^=\s*/, '').trim();
  const comment = draft.comment.trim();
  const scope = draft.scope || null;

  if (!name) throw new Error(t('error.named.nameEmpty'));
  if (!expression) throw new Error(t('named.expressionRequired'));

  if (target === null) {
    // Straight to the registry that owns defined names. `INamedCollection.addFormula` takes only a
    // name and an expression; going through the owner lets the scope, comment and hidden flag land
    // in the same write instead of as three follow-up commits.
    // No `description`: add() always describes its own commit (`op.addNamedFormulaNamed`).
    workbook.getCalculation().getNamedFormulas().add({
      name,
      expression,
      scope,
      comment: comment || undefined,
      hidden: draft.hidden || undefined
    });
    return;
  }

  // Validated before anything is written: `setName` throws on a bad or taken name, and a throw
  // partway through the batch would leave the other fields already applied.
  if (name.toLowerCase() !== target.getName().toLowerCase()) {
    workbook.getNames().validateName(name, scope ?? undefined);
  }

  // Scope changed? That is not an edit — it is a different name. There is no `setScope`, because
  // scope decides the symbol a definition compiles into and that id is minted once, at `add`
  // (see `INamed.getScope`). Excel says the same by having no scope setter at all. So drop and
  // redefine, in ONE commit so it is a single undo entry and never observed half-applied.
  // Dependent formulas re-resolve through `IndirectSymbolProvider.reconcile`: those on the old
  // scope go `#NAME?` — correct, the name no longer exists there — and those on the new one bind.
  if ((target.getScope() ?? null) !== scope) {
    // Only calc-owned names have a scope to change, and only they can be deleted; a table's
    // derived `INamed` is neither editable nor removable through this pane.
    if (!draft.editable || !target.delete) throw new Error(t('error.named.nameReadonly'));
    const trans = workbook.getTransactions().beginCommit({ description: t('op.updateNamed', { name }) });
    try {
      target.delete();
      workbook.getCalculation().getNamedFormulas().add({
        name,
        expression,
        scope,
        comment: comment || undefined,
        hidden: draft.hidden || undefined
      });
      trans.commit();
    } catch (error: any) {
      trans.rollback();
      throw error;
    }
    return;
  }

  target.doBatch(() => {
    if (name !== target.getName()) {
      target.setName(name);
    }
    if (draft.editable && expression !== expressionOf(target)) {
      (target as ICalculation.INamedFormula).setExpression(expression);
    }
    if ((target.getComment() ?? '') !== comment) {
      target.setComment(comment || null);
    }
    if (target.isHidden() !== draft.hidden) {
      target.setHidden?.(draft.hidden);
    }
    // Scope is not written here — a change to it took the delete-and-redefine path above.
  }, { description: t('op.updateNamed', { name }) });
};
