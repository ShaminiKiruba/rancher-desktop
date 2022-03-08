import fs from 'fs';
import isEqual from 'lodash/isEqual.js';

export const START_LINE = "### MANAGED BY RANCHER DESKTOP START (DO NOT EDIT)"
export const END_LINE = "### MANAGED BY RANCHER DESKTOP END (DO NOT EDIT)"
const DEFAULT_FILE_MODE = 0o644;

export async function manageLinesInFile(path: string, desiredManagedLines: string[], desiredPresent: boolean): Promise<void> {
  // read file, creating it if it doesn't exist
  let currentContent: string;
  let fileMode: number;
  try {
    currentContent = await fs.promises.readFile(path, "utf8");
    fileMode = (await fs.promises.stat(path)).mode;
  } catch (error: any) {
    if (error.code === 'ENOENT' && desiredPresent) {
      const lines = buildFileLines([], desiredManagedLines, []);
      const content = lines.join('\n')
      await fs.promises.writeFile(path, content, {mode: DEFAULT_FILE_MODE});
      return;
    } else {
      throw error;
    }
  }

  // split file into three parts
  let before: string[];
  let currentManagedLines: string[];
  let after: string[];
  try {
    const currentLines = currentContent.split("\n");
    [before, currentManagedLines, after] = splitLinesByDelimiters(currentLines);
  } catch (error) {
    throw new Error(`could not split ${path}: ${error}`);
  }

  // make the changes
  if (desiredPresent && !isEqual(currentManagedLines, desiredManagedLines)) {
    const newLines = buildFileLines(before, desiredManagedLines, after);
    const newContent = newLines.join("\n");
    fs.promises.writeFile(path, newContent, {mode: fileMode});
  }
  if (!desiredPresent) {
    if (before.length === 0 && after.length === 0) {
      await fs.promises.rm(path);
    } else {
      const newLines = buildFileLines(before, [], after);
      const newContent = newLines.join("\n");
      fs.promises.writeFile(path, newContent, {mode: fileMode});
    }
  }
}

function splitLinesByDelimiters(lines: string[]): [string[], string[], string[]] {
	const startIndex = lines.indexOf(START_LINE);
	const endIndex = lines.indexOf(END_LINE);

	if (startIndex < 0 && endIndex < 0) {
    return [lines, [], []];
  } else if (startIndex < 0 || endIndex < 0) {
    throw new Error('exactly one of the delimiter lines is not present');
  } else if (startIndex >= endIndex) {
    throw new Error('the delimiter lines are in the wrong order');
  }

  const before = lines.slice(0, startIndex);
  const currentManagedLines = lines.slice(startIndex + 1, endIndex);
  const after = lines.slice(endIndex + 1);
  return [before, currentManagedLines, after];
}

function buildFileLines(before: string[], toInsert: string[], after: string[]): string[] {
  const rancherDesktopLines = toInsert.length > 0 ? [START_LINE, ...toInsert, END_LINE] : [];
  return [...before, ...rancherDesktopLines, ...after];
}
