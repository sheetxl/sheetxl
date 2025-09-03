
export const arrayToFile = async (fileNameWithExt: string, bufferLike: ArrayBufferLike): Promise<void> => {
  const fs = await import(/* @vite-ignore */ /* webpackIgnore: true */ 'fs/promises');
  const buffer = Buffer.from(bufferLike);
  await fs.writeFile(fileNameWithExt, buffer);
}