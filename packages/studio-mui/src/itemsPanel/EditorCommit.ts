import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * Commits whatever a field still holds onto the editor's draft.
 *
 * @returns `false` to refuse the save — the field holds text it cannot commit — which leaves the
 * editor open on it.
 */
export type EditorCommit = () => boolean;

/**
 * Where a field inside an {@link EditorPanel} registers to be committed when Save is pressed.
 */
export interface EditorCommits {
  /**
   * @returns An unregister callback.
   */
  register(commit: EditorCommit): () => void;
}

/**
 * Provided by {@link EditorPanel}; `null` outside of one.
 */
export const EditorCommitContext = createContext<EditorCommits | null>(null);

/**
 * Has the enclosing {@link EditorPanel} commit this field before it saves.
 *
 * @remarks
 * For a field that commits on done rather than per change. Its commit points are its own keys, its
 * ✓ and a blur to another field; Save is a button, which takes focus without any of them, so text
 * typed but not yet committed would never reach the draft the save reads.
 *
 * Does nothing outside an editor — the same field on a card has no Save to answer to.
 */
export const useEditorCommit = (commit: EditorCommit): void => {
  const commits = useContext(EditorCommitContext);
  const refCommit = useRef<EditorCommit>(commit);
  refCommit.current = commit;
  useEffect(() => {
    if (!commits) return;
    return commits.register(() => refCommit.current());
  }, [commits]);
};
