import { readFileSync } from 'fs';
import { join, resolve } from 'path';

export function readVcfFixture(fileName: string): string {
  const filePath = join(__dirname, fileName);
  return readFileSync(filePath, 'utf8');
}

export function readFrontmatterFixture(fileName: string): Record<string, any>|undefined {
  const fullPath = resolve(__dirname, fileName + '.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  try {
    return require(fullPath);
  } catch (e) {
    return;
  }

}

export const fixtures = {
  readVcfFixture,
  readFrontmatterFixture
}
