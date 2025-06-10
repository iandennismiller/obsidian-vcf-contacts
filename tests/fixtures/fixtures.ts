import { readFileSync } from 'fs';
import { join } from 'path';

export function readVcfFixture(fileName: string): string {
  const filePath = join(__dirname, fileName);
  return readFileSync(filePath, 'utf8');
}

export const fixtures = {
  readVcfFixture
}
