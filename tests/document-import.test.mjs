import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readPublicDocument } from '../document-import.mjs';

const base = new URL('../samples/', import.meta.url);
const names = await readdir(base);
async function sample(suffix) {
  const name = names.find((item) => item.endsWith(suffix));
  return new File([await readFile(new URL(`../samples/${name}`, import.meta.url))], name);
}

test('UTF-8 TXT and MD load public text with article heading', async () => {
  for (const suffix of ['.txt', '.md']) {
    const text = await readPublicDocument(await sample(suffix));
    assert.match(text, /^제96조/);
    assert.match(text, /실제 법령 원문이 아니/);
  }
});

test('text PDF loads but image-only PDF reports OCR limitation', async () => {
  const text = await readPublicDocument(await sample('가상조문.pdf'));
  assert.match(text, /제96조/);
  assert.match(text, /소멸시효 기간/);
  await assert.rejects(async () => readPublicDocument(await sample('이미지형.pdf')), /이미지형 스캔 PDF/);
});

test('unsupported, invalid UTF-8 and oversized files fail rather than invent text', async () => {
  await assert.rejects(() => readPublicDocument(new File(['abc'], 'internal.hwp')), /지원/);
  await assert.rejects(() => readPublicDocument(new File([new Uint8Array([0xff, 0xfe])], 'a.txt')), /UTF-8/);
  await assert.rejects(() => readPublicDocument(new File(['x'.repeat(8_000_001)], 'huge.txt')), /8MB/);
});
