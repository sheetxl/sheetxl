import { describe, expect, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook, type IGroup, type IMovable, type IPicture } from '@sheetxl/sdk';

import { IOPlugin } from '..';

/**
 * A group's picture member keeps its image through the native format: the member's picture
 * names the resource by the id each persist scope gives it, so what was read from `.sxl` writes
 * to xlsx with the same bytes.
 */
WorkbookIO.install(IOPlugin);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

const firstGroup = (workbook: IWorkbook): IMovable => workbook.getWorksheetAt(0)!.getMovables().getItems({ type: 'group' })[0];

/** The images the group's picture members hold. */
const memberImages = async (movable: IMovable): Promise<Uint8Array[]> => {
  const images: Uint8Array[] = [];
  for (const member of movable.getMovables()!.getItems({ type: 'picture' })) {
    images.push(new Uint8Array(await member.getContent<IPicture>().getResource().toBuffer()));
  }
  return images;
};

describe('a picture inside a group (sxl)', () => {
  it('keeps the member\'s image from the native format out to xlsx', async () => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    const logo = workbook.getResources().add({ source: { buffer: PNG.buffer.slice(0) as ArrayBuffer } });
    const group: IGroup.JSON = {
      childBounds: { x: 0, y: 0, width: 100, height: 100 },
      members: [{
        anchor: { tl: { x: 0, y: 0 }, br: { x: 100, y: 100 } },
        content: { type: 'picture', name: 'Logo', json: { resId: 5 } }
      }],
    };
    await workbook.getWorksheetAt(0)!.getMovables().add({
      type: 'group', json: group, bounds: { x: 0, y: 0, width: 100, height: 100 }, fromResourceId: (id: number) => (id === 5 ? logo : undefined)!
    });
    expect(await memberImages(firstGroup(workbook))).toEqual([PNG]);

    const native = await WorkbookIO.writeArrayBuffer(workbook, { format: 'sxl' }) as ArrayBuffer;
    const fromNative = (await WorkbookIO.read({ source: native, format: 'sxl' }))!;
    expect(await memberImages(firstGroup(fromNative))).toEqual([PNG]);

    const xlsx = await WorkbookIO.writeArrayBuffer(fromNative, { format: 'Excel' }) as ArrayBuffer;
    const fromXlsx = (await WorkbookIO.read({ source: xlsx, format: 'Excel' }))!;
    const members = firstGroup(fromXlsx).getMovables()!.getItems();
    expect(members.map((m) => [m.getContent().getType(), m.getContent().getName?.()])).toEqual([['picture', 'Logo']]);
    expect(await memberImages(firstGroup(fromXlsx))).toEqual([PNG]);
  });
});
