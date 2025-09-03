import { ChainedError } from '@sheetxl/utils';
import { IOUtils } from '@sheetxl/io';

export interface DirectoryFile<M=any> {
  path: string;
  metadata?: M;
  content: string;
}

export interface DirectoryEntry<M=any> {
  path: string;
  metadata?: M;
}

const toName = (entry: DirectoryEntry): string => {
  if (entry.metadata?.name) return entry.metadata.name;

  // Convert path to name by removing file extension and replacing slashes with spaces
  const path = entry.path;
  const fileName = path.split('/').pop() || '';
  let name = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension

  if (entry.metadata?.icon === 'formula') return name.toUpperCase();

  // Insert spaces before camelCase capitals
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Replace dashes and underscores with spaces, then capitalize each word
  const retValue = name
    .replace(/[-_]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return retValue;
}

/**
 * Fetches and loads 'virtual files' using fetch.
 *
 * @remarks
 * This function only works if there is a directory.json file at the directory path.
 *
 * @returns {Promise<DirectoryFile[]>} A promise that resolves to the content of the directory.
 */
export const fetchDirectory = async (directoryPath: string): Promise<DirectoryFile[]> => {
  // Fetch directory.json
  const asUrl = IOUtils.relativePath(directoryPath, './manifest.json');
  const response = await fetch(asUrl);
  if (!response.ok) {
    throw new ChainedError(`Failed to retrieve directory at '${directoryPath}': ${response.statusText}`);
  }

  // Read response as text first to allow HTML detection
  const responseText = await response.text();

  // Check if the response is HTML (common when servers auto-redirect to error pages)
  const isHtmlResponse = responseText.trim().toLowerCase().startsWith('<!doctype html') ||
                        responseText.trim().toLowerCase().startsWith('<html');

  if (isHtmlResponse) {
    throw new ChainedError(`Failed to retrieve directory at '${directoryPath}'`);
  }

  let entries: DirectoryEntry[];
  try {
    entries = JSON.parse(responseText);
  } catch (error: any) {
    throw new Error(`Failed to parse directory: ${error.message}. Ensure the file is valid JSON.`);
  }

  // Fetch and load each entry
  const entriesPromises = entries.map(async (entry: DirectoryEntry) => {
    try {
      const pathEntry = IOUtils.relativePath(directoryPath, entry.path);
      const entryResponse = await fetch(pathEntry);
      if (!entryResponse.ok) {
        throw new Error(`Failed to fetch file at '${entry.path}': ${entryResponse.statusText}`);
      }
      const content = await entryResponse.text();
      let metadata = entry.metadata;
      if (!metadata?.title) {
        metadata = {
          title: toName(entry),
          ...metadata
        }
      }
      const retValue:DirectoryFile = {
        path: entry.path,
        content,
        metadata
      };
      return retValue;
    } catch (error: any) {
      console.error(error.message);
    }
    return null;
  });

  // Filter out null values and return
  const results = await Promise.all(entriesPromises);
  return results.filter(result => result !== null);
}