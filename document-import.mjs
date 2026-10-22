export const ACCEPTED_DOCUMENTS = ['txt', 'md', 'pdf', 'docx'];
const MAX_BYTES = 8_000_000;
const MAX_CHARS = 30_000;

function checkedText(text) {
  const content = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!content) throw new Error('이 파일에서 읽을 수 있는 글자를 찾지 못했습니다.');
  if (content.length > MAX_CHARS) throw new Error('원문은 파일당 3만 자 이내로 준비해 주세요.');
  return content;
}

export async function readPublicDocument(file) {
  const name = String(file?.name || '');
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ACCEPTED_DOCUMENTS.includes(ext)) throw new Error(`${name}: TXT·MD·DOCX 또는 글자가 포함된 PDF만 지원합니다.`);
  if (file.size > MAX_BYTES) throw new Error(`${name}: 8MB를 넘는 파일은 읽지 않습니다.`);
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (ext === 'txt' || ext === 'md') {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error(`${name}: UTF-8 형식의 텍스트 파일을 사용해 주세요.`); }
    return checkedText(text);
  }

  if (ext === 'docx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`${name}: 유효한 DOCX 파일이 아닙니다.`);
    const { unzipSync, strFromU8 } = await import('./node_modules/fflate/esm/browser.js');
    let archive;
    let oversizedPart = false;
    try { archive = unzipSync(bytes, { filter: ({ name, originalSize }) => {
      if (name !== 'word/document.xml') return false;
      if (originalSize > 1_000_000) { oversizedPart = true; return false; }
      return true;
    } }); }
    catch { throw new Error(`${name}: DOCX 압축 파일을 읽을 수 없습니다.`); }
    if (oversizedPart) throw new Error(`${name}: DOCX 본문이 너무 큽니다. 작은 공개 조문만 사용해 주세요.`);
    const part = archive['word/document.xml'];
    if (!part) throw new Error(`${name}: DOCX 본문을 찾을 수 없습니다.`);
    const xml = new DOMParser().parseFromString(strFromU8(part), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error(`${name}: DOCX 본문 XML이 올바르지 않습니다.`);
    const wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const paragraphs = [...xml.getElementsByTagNameNS(wordNs, 'p')]
      .map((paragraph) => [...paragraph.getElementsByTagNameNS(wordNs, 't')].map((text) => text.textContent).join(''));
    return checkedText(paragraphs.join('\n'));
  }

  if (bytes.slice(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index]) === false) {
    throw new Error(`${name}: 유효한 PDF 파일이 아닙니다.`);
  }
  const { getDocument, GlobalWorkerOptions } = await import('./node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  GlobalWorkerOptions.workerSrc = new URL('./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  try {
    if (pdf.numPages > 15) throw new Error(`${name}: PDF는 15쪽 이하만 지원합니다.`);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join(''));
      page.cleanup();
    }
    const text = pages.join('\n');
    if (text.trim().length < 10) throw new Error(`${name}: 이미지형 스캔 PDF는 판독할 수 없습니다. 글자가 포함된 PDF 또는 공개 텍스트를 사용해 주세요.`);
    return checkedText(text);
  } finally { await pdf.destroy(); }
}
