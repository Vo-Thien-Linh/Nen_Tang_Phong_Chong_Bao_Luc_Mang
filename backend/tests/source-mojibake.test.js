import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoots = ['backend/src', 'frontend/src'];
const mojibakePattern = /Ã(?:ƒ|„|…|[ -¿])|[áÁ][º»]|Ä[\u0080-\u00bf]|â(?:‚|€)|Â[\u0080-\u00bf]/u;

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.jsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

test('source files do not contain mojibake Vietnamese text', () => {
  const hits = sourceRoots.flatMap((sourceRoot) => collectSourceFiles(path.join(repoRoot, sourceRoot)))
    .flatMap((filePath) => readFileSync(filePath, 'utf8').split(/\r?\n/)
      .flatMap((line, index) => mojibakePattern.test(line)
        ? [`${path.relative(repoRoot, filePath)}:${index + 1}`]
        : []));

  assert.equal(hits.length, 0, `Mojibake found at:\n${hits.join('\n')}`);
});
