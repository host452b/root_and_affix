import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function atomicWriteText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp';
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, path);
}

export function atomicWriteJson(path: string, data: unknown): void {
  atomicWriteText(path, JSON.stringify(data, null, 2));
}
