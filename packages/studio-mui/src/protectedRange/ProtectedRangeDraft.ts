import { type IProtectedRange } from '@sheetxl/sdk';

/**
 * Plain-text passwords staged for the temporary item being edited.
 *
 * @remarks
 * `IProtectedRange.setPassword` hashes, so it is async and cannot run from the editor without
 * racing the Save button. The editor parks the plain text here and the descriptor's `beforeSave`
 * awaits the hash — so the plain text lives only as long as the editor is open and never reaches
 * the model, its JSON, or the file.
 *
 * Absent means "unchanged"; `null` means "remove it".
 */
export const stagedPasswords = new WeakMap<IProtectedRange, string | null>();

/**
 * Applies any staged password to `item`. Called from the descriptor's `beforeSave`.
 *
 * @remarks
 * Nothing to validate: the password is typed and confirmed in `PasswordDialog`, which only reports
 * one it has already checked against its confirm field.
 */
export const flushStagedPassword = async (item: IProtectedRange): Promise<void> => {
  if (!stagedPasswords.has(item)) return;
  const password = stagedPasswords.get(item)!;
  stagedPasswords.delete(item);
  await item.setPassword(password);
};
