import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Workbook, type IWorksheet, type IWorkbook } from '@sheetxl/sdk';

import { PersistentStateProvider, InMemoryStore, type PersistenceStore } from '@sheetxl/utils-react';

import { type CommentsPaneArgs } from '@sheetxl/react';

import { CommentsTaskPane } from '../comments/CommentsTaskPane';

/**
 * The **Comments** pane: every thread on the sheet in cell order, each a card
 * that is replied to, edited, resolved and deleted in place, and a draft that writes nothing until
 * it is posted.
 */
describe('CommentsTaskPane', () => {
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  let root: Root | null = null;

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    root = null;
    document.body.innerHTML = '';
  });

  const newWorkbook = async (): Promise<{ workbook: IWorkbook, sheet: IWorksheet }> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    workbook.getPeople().setCurrent('Ada Lovelace');
    return { workbook, sheet: workbook.getSelectedWorksheet()! };
  };

  /* A store of its own unless one is handed in: the filter is a preference and outlives a pane. */
  const mount = async (workbook: IWorkbook, args?: CommentsPaneArgs, store: PersistenceStore = new InMemoryStore()) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const render = async (nextArgs?: CommentsPaneArgs): Promise<void> => {
      await act(async () => {
        root!.render(createElement(PersistentStateProvider as never, { store, debounceMs: 0 } as never,
          createElement(CommentsTaskPane as never, { model: workbook, entryKey: 'comments', args: nextArgs })));
      });
    };
    await render(args);

    const cards = (): HTMLElement[] => Array.from(container.querySelectorAll('.sxl-comment-card')) as HTMLElement[];
    const buttonIn = (within: ParentNode, label: string): HTMLButtonElement | null =>
      (Array.from(within.querySelectorAll('button')) as HTMLButtonElement[])
        .find((each: HTMLButtonElement) => (each.textContent ?? '').trim() === label) ?? null;
    const click = async (element: HTMLElement): Promise<void> => { await act(async () => { element.click(); }); };
    const type = async (field: HTMLTextAreaElement, text: string): Promise<void> => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
        setter.call(field, text);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const fieldOf = (card: HTMLElement): HTMLTextAreaElement =>
      card.querySelector('.sxl-comment-field textarea:not([aria-hidden])') as HTMLTextAreaElement;
    /** Opens an entry's menu and clicks the item with this label. */
    const menu = async (card: HTMLElement, entry: number, label: string): Promise<void> => {
      await click(card.querySelectorAll('.sxl-comment-menu')[entry] as HTMLElement);
      const item = (Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[])
        .find((each: HTMLElement) => (each.textContent ?? '').trim() === label);
      expect(item, label).toBeTruthy();
      await click(item!);
    };
    return {
      container, render, cards, buttonIn, click, type, fieldOf, menu,
      texts: (): string[] => cards().map((card: HTMLElement) => card.querySelector('.sxl-comment-text')?.textContent ?? '')
    };
  };

  it('lists the threads in cell order with who wrote them, and leaves the notes out', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('D4', 'third');
    sheet.getComments().add('B2', 'first').addReply('a reply');
    sheet.getComments().add('E2', 'second');
    sheet.getComments().add('C3', 'a note', { asNote: true });

    const pane = await mount(workbook);

    expect(pane.texts()).toEqual(['first', 'second', 'third']);
    const first = pane.cards()[0];
    // The cell is named once, on the first entry's header line.
    expect(first.querySelectorAll('.sxl-comment-address').length).toBe(1);
    expect(first.querySelector('.sxl-comment-entry .sxl-comment-address')!.textContent).toBe('B2');
    expect(first.querySelector('.sxl-comment-author')!.textContent).toBe('Ada Lovelace');
    expect(first.querySelector('.MuiAvatar-root')!.textContent).toBe('AL');
    expect(first.querySelector('.sxl-comment-time')).toBeTruthy();
    expect(Array.from(first.querySelectorAll('.sxl-comment-text')).map((each) => each.textContent)).toEqual(['first', 'a reply']);
  });

  it('offers to add when the sheet has no comments', async () => {
    const { workbook } = await newWorkbook();
    const pane = await mount(workbook);
    expect(pane.cards()).toEqual([]);
    expect(pane.container.textContent).toContain('Add comments to discuss cells with others.');
    expect(pane.container.querySelector('.sxl-comments-filter')).toBeNull();

    await pane.click(pane.buttonIn(pane.container.querySelector('.sxl-comments-empty')!, 'New Comment')!);
    expect(pane.cards().length).toBe(1);
    expect(pane.container.querySelector('.sxl-comments-empty')).toBeNull();
  });

  it('filters by resolved', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('B2', 'open');
    sheet.getComments().add('D4', 'done').setResolved(true);
    const pane = await mount(workbook);
    expect(pane.texts()).toEqual(['open', 'done']);

    await pane.click(pane.buttonIn(pane.container, 'Resolved')!);
    expect(pane.texts()).toEqual(['done']);

    await pane.click(pane.buttonIn(pane.container, 'Open')!);
    expect(pane.texts()).toEqual(['open']);

    // A thread reopened leaves the resolved list.
    await pane.click(pane.buttonIn(pane.container, 'Resolved')!);
    await act(async () => { sheet.getComments().getAt('D4')!.setResolved(false); });
    expect(pane.cards()).toEqual([]);
    expect(pane.container.textContent).toContain('No comments match.');
  });

  it('the filter is a preference: the pane reopens on the one it was left on', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('B2', 'open');
    sheet.getComments().add('D4', 'done').setResolved(true);
    const store = new InMemoryStore();
    const first = await mount(workbook, undefined, store);
    await first.click(first.buttonIn(first.container, 'Resolved')!);
    expect(first.texts()).toEqual(['done']);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    await act(async () => { root!.unmount(); });

    const second = await mount(workbook, undefined, store);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(second.texts()).toEqual(['done']);

    // A thread a command goes to is shown whatever the filter, and the preference is kept.
    await second.render({ focus: sheet.getComments().getAt('B2')! });
    expect(second.texts()).toEqual(['open', 'done']);
  });

  it('`insert` opens a draft on the selected cell, in cell order, and writes nothing until Post', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('B2', 'first');
    sheet.getComments().add('D4', 'third');
    await sheet.getRange('C3').select();

    const pane = await mount(workbook, { insert: true });

    expect(pane.cards().length).toBe(3);
    const draft = pane.cards()[1];
    expect(draft.classList.contains('sxl-comment-draft')).toBe(true);
    expect(draft.querySelector('.sxl-comment-address')!.textContent).toBe('C3');
    // Who it will be posted as, before it is.
    expect(draft.querySelector('.sxl-comment-author')!.textContent).toBe('Ada Lovelace');
    expect(draft.querySelector('.sxl-comment-menu')).toBeNull();
    expect(document.activeElement).toBe(pane.fieldOf(draft));
    expect(sheet.getComments().getCount()).toBe(2);

    // Nothing typed is nothing to post.
    expect(pane.buttonIn(draft, 'Post')!.disabled).toBe(true);
    await pane.type(pane.fieldOf(draft), 'second');
    expect(sheet.getComments().getCount()).toBe(2);

    await pane.click(pane.buttonIn(draft, 'Post')!);
    const posted = sheet.getComments().getAt('C3')!;
    expect(posted.getContent()).toBe('second');
    expect(posted.isNote()).toBe(false);
    expect(posted.getAuthor()?.getDisplayName()).toBe('Ada Lovelace');
    expect(pane.texts()).toEqual(['first', 'second', 'third']);
    expect(pane.container.querySelector('.sxl-comment-draft')).toBeNull();
  });

  it('a cancelled draft is dropped', async () => {
    const { workbook, sheet } = await newWorkbook();
    await sheet.getRange('C3').select();
    const pane = await mount(workbook, { insert: true });
    const draft = pane.cards()[0];
    await pane.type(pane.fieldOf(draft), 'never mind');

    await pane.click(pane.buttonIn(draft, 'Cancel')!);

    expect(pane.cards()).toEqual([]);
    expect(sheet.getComments().getCount()).toBe(0);
  });

  it('`insert` on a cell with a thread goes to its reply box, and `focus` to the thread named', async () => {
    const { workbook, sheet } = await newWorkbook();
    const first = sheet.getComments().add('B2', 'first');
    sheet.getComments().add('D4', 'second');
    await sheet.getRange('D4').select();

    const pane = await mount(workbook, { insert: true });
    expect(pane.cards().length).toBe(2);
    expect(document.activeElement).toBe(pane.fieldOf(pane.cards()[1]));

    await pane.render({ focus: first });
    expect(document.activeElement).toBe(pane.fieldOf(pane.cards()[0]));
  });

  it('a reply is posted from the reply box', async () => {
    const { workbook, sheet } = await newWorkbook();
    const thread = sheet.getComments().add('B2', 'first');
    const pane = await mount(workbook);
    const card = pane.cards()[0];

    // The buttons wait for something to post.
    expect(pane.buttonIn(card, 'Post')).toBeNull();
    await pane.type(pane.fieldOf(card), 'a reply');
    await pane.click(pane.buttonIn(card, 'Post')!);

    expect(thread.getReplies().map((reply) => reply.getContent())).toEqual(['a reply']);
    expect(pane.fieldOf(pane.cards()[0]).value).toBe('');
  });

  it('the menu edits, resolves and deletes; a resolved thread takes no reply until reopened', async () => {
    const { workbook, sheet } = await newWorkbook();
    const thread = sheet.getComments().add('B2', 'first');
    thread.addReply('a reply');
    const pane = await mount(workbook);
    const card = (): HTMLElement => pane.cards()[0];

    await pane.menu(card(), 0, 'Edit');
    const editor = pane.fieldOf(card());
    expect(editor.value).toBe('first');
    await pane.type(editor, 'first, edited');
    await pane.click(pane.buttonIn(card(), 'Save')!);
    expect(thread.getContent()).toBe('first, edited');

    await pane.menu(card(), 1, 'Delete');
    expect(thread.getReplies()).toEqual([]);

    await pane.menu(card(), 0, 'Resolve thread');
    expect(thread.isResolved()).toBe(true);
    expect(card().querySelector('.sxl-comment-field')).toBeNull();
    // Resolved: a header to reopen or delete from, and no menus to edit with.
    expect(card().querySelector('.sxl-comment-resolved-header')!.textContent).toContain('Resolved');
    expect(card().querySelector('.sxl-comment-menu')).toBeNull();
    await pane.click(card().querySelector('.sxl-comment-reopen') as HTMLElement);
    expect(thread.isResolved()).toBe(false);
    expect(pane.fieldOf(card())).toBeTruthy();

    await pane.menu(card(), 0, 'Delete');
    expect(sheet.getComments().getCount()).toBe(0);
    expect(pane.cards()).toEqual([]);
  });

  it('clicking a card selects its cell, and selecting a cell marks its card', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('B2', 'first');
    sheet.getComments().add('D4', 'second');
    await sheet.getRange('A1').select();
    const pane = await mount(workbook);
    expect(pane.container.querySelector('.sxl-comment-highlighted')).toBeNull();

    await pane.click(pane.cards()[1].querySelector('.sxl-comment-text') as HTMLElement);
    await act(async () => { await Promise.resolve(); });
    expect(sheet.getSelectedRanges().getAddress()).toBe('D4');
    expect(pane.cards()[1].classList.contains('sxl-comment-highlighted')).toBe(true);

    await act(async () => { await sheet.getRange('B2').select(); });
    expect(pane.cards()[0].classList.contains('sxl-comment-highlighted')).toBe(true);
    expect(pane.cards()[1].classList.contains('sxl-comment-highlighted')).toBe(false);
  });

  it('a note on the selected cell leaves nothing to add', async () => {
    const { workbook, sheet } = await newWorkbook();
    sheet.getComments().add('B2', 'a note', { asNote: true });
    await sheet.getRange('B2').select();
    const pane = await mount(workbook, { insert: true });
    expect(pane.cards()).toEqual([]);
    expect(pane.buttonIn(pane.container.querySelector('.sxl-comments-empty')!, 'New Comment')!.disabled).toBe(true);
  });

});
