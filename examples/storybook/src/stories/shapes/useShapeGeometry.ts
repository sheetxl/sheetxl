import { useEffect, useState } from 'react';

import { type IGeometry, type IShape, Worksheet } from '@sheetxl/sdk';

let _sheet: Worksheet | null = null;

/** A detached sheet the stories place their shapes on, so geometry is asked of a shape as an application asks it. */
const scratch = (): Worksheet => (_sheet ??= new Worksheet());

/**
 * A shape's geometry at a size, or `null` until it has loaded. The shape is placed, asked and
 * deleted; the geometry it answered stays good.
 */
export const useShapeGeometry = (json: IShape.JSON, width: number, height: number): IGeometry | null => {
  const [geometry, setGeometry] = useState<IGeometry | null>(null);
  const key = JSON.stringify(json);
  useEffect(() => {
    let live = true;
    (async (): Promise<IGeometry | null> => {
      const movable = await scratch().getMovables().add({
        type: 'shape', json: JSON.parse(key), bounds: { x: 0, y: 0, width: Math.max(width, 1), height: Math.max(height, 1) },
      });
      const shape = movable.getContent<IShape>();
      try {
        return await shape.getGeometry(width, height);
      } finally {
        shape.delete();
      }
    })().then((loaded) => { if (live) setGeometry(loaded); }, () => { if (live) setGeometry(null); });
    return () => { live = false; };
  }, [key, width, height]);
  return geometry;
};
