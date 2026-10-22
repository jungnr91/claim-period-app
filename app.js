import { comparePeriods, findCandidates, REFERENCES } from './engine.mjs';
import { readPublicDocument } from './document-import.mjs';

const $ = (selector) => document.querySelector(selector);
let importing = false;
const sampleLaws = [
  {
    title: '국가재정법', date: '2026-09-11', url: REFERENCES[0].source,
    text: '제96조(금전채권ㆍ채무의 소멸시효) ①금전의 급부를 목적으로 하는 국가의 권리로서 시효에 관하여 다른 법률에 규정이 없는 것은 5년 동안 행사하지 아니하면 시효로 인하여 소멸한다.\n②국가에 대한 권리로서 금전의 급부를 목적으로 하는 것도 또한 제1항과 같다.\n③금전의 급부를 목적으로 하는 국가의 권리의 경우 소멸시효의 중단ㆍ정지 그 밖의 사항에 관하여 다른 법률의 규정이 없는 때에는 「민법」의 규정을 적용한다.'
  },
  {
    title: '민법', date: '2026-03-17', url: REFERENCES[1].source,
    text: '제162조(채권, 재산권의 소멸시효) ①채권은 10년간 행사하지 아니하면 소멸시효가 완성한다.\n②채권 및 소유권 이외의 재산권은 20년간 행사하지 아니하면 소멸시효가 완성한다.'
  }
];

function status(selector, text) {
  const node = $(selector);
  node.hidden = !text;
  node.textContent = text;
}

function switchView(view) {
  $('#research-view').hidden = view !== 'research';
  $('#calculator-view').hidden = view !== 'calculator';
  $('#top-location').textContent = view === 'research' ? '규정 근거 찾기' : '기간 참고 계산';
  for (const button of document.querySelectorAll('.nav-link')) {
    button.classList.toggle('active', button.dataset.view === view);
    button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
for (const button of document.querySelectorAll('.nav-link')) button.addEventListener('click', () => switchView(button.dataset.view));

$('#sample-search').addEventListener('click', () => {
  $('#question').value = '국가 금전채권의 소멸시효 기간은?';
  sampleLaws.forEach((item, index) => {
    const prefix = `#source${index + 1}-`;
    $(`${prefix}title`).value = item.title;
    $(`${prefix}date`).value = item.date;
    $(`${prefix}url`).value = item.url;
    $(`${prefix}text`).value = item.text;
    const card = document.querySelectorAll('.source-card')[index];
    card.classList.remove('loaded');
    card.querySelector('.source-import-name')?.remove();
  });
  $('#search-button').click();
  status('#search-error', '공개 조문 예시를 채웠습니다. 공식 사이트에서 내용과 시행일을 다시 확인해 주세요.');
});

function importMessage(text, error = false) {
  status('#import-status', text);
  $('#import-status').classList.toggle('error', error);
}

async function importFiles(files, requestedSlot = null) {
  if (!files.length || importing) return;
  importing = true;
  $('#import-button').disabled = true;
  $('#import-zone').classList.add('importing');
  importMessage('공개 문서의 글자를 로컬에서 읽고 있습니다…');
  try {
    if (files.length > 2) throw new Error('한 번에 최대 두 개의 공개 규정 파일만 올릴 수 있습니다.');
    let slots;
    if (files.length === 2) slots = [0, 1];
    else if (requestedSlot !== null) slots = [requestedSlot];
    else {
      const empty = [...document.querySelectorAll('.source-card')].findIndex((card) => !card.querySelector('textarea').value.trim());
      if (empty < 0) throw new Error('두 자료 칸이 모두 차 있습니다. 교체할 자료 카드 위에 파일을 직접 놓아 주세요.');
      slots = [empty];
    }
    const texts = await Promise.all(files.map((file) => readPublicDocument(file)));
    for (const text of texts) {
      if (!/(?:^|\n)\s*제\d+조/.test(text)) {
        throw new Error('제○조 형태의 조문 시작을 찾지 못했습니다. 글자가 포함된 공개 규정인지 확인하거나 원문을 직접 붙여넣어 주세요.');
      }
    }
    if (slots.some((slot) => document.querySelectorAll('.source-card')[slot].querySelector('textarea').value.trim())
      && !window.confirm('선택한 자료 칸의 기존 원문·법령명·시행일·링크를 새 파일로 교체할까요?')) {
      importMessage('기존 자료를 유지했습니다.');
      return;
    }
    files.forEach((file, index) => {
      const slot = slots[index];
      const prefix = `#source${slot + 1}-`;
      $(`${prefix}title`).value = '';
      $(`${prefix}date`).value = '';
      $(`${prefix}url`).value = '';
      $(`${prefix}text`).value = texts[index];
      const card = document.querySelectorAll('.source-card')[slot];
      card.classList.add('loaded');
      card.querySelector('.source-import-name')?.remove();
      const label = el('span', 'source-import-name', `${file.name} · 원문 ${texts[index].length.toLocaleString('ko-KR')}자`);
      card.querySelector('.source-title').append(label);
    });
    $('#search-results').hidden = true;
    if ($('#question').value.trim()) $('#search-button').click();
    importMessage(`${files.length}개 공개 원문을 불러왔습니다. 법령명·시행일·공식 링크는 확인 후 직접 입력하세요.${$('#question').value.trim() ? ' 기존 가상 질문으로 근거 후보를 다시 찾았습니다.' : ' 가상 질문을 입력하면 검색할 수 있습니다.'}`);
  } catch (error) { importMessage(error.message || '파일을 읽지 못했습니다.', true); }
  finally {
    importing = false;
    $('#import-button').disabled = false;
    $('#import-zone').classList.remove('importing');
  }
}

$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  await importFiles(files);
  event.target.value = '';
});

let dragDepth = 0;
function highlight(active, target = null) {
  $('#import-zone').classList.toggle('drag-active', active);
  document.querySelectorAll('.source-card').forEach((card, index) => card.classList.toggle('drag-active', active && target === index));
}
window.addEventListener('dragenter', (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  dragDepth++;
  const card = event.target.closest?.('.source-card');
  highlight(true, card ? [...document.querySelectorAll('.source-card')].indexOf(card) : null);
});
window.addEventListener('dragover', (event) => {
  if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  const card = event.target.closest?.('.source-card');
  highlight(true, card ? [...document.querySelectorAll('.source-card')].indexOf(card) : null);
});
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) highlight(false);
});
window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  const card = event.target.closest?.('.source-card');
  const slot = card ? [...document.querySelectorAll('.source-card')].indexOf(card) : null;
  highlight(false);
  if (event.dataTransfer?.files?.length) importFiles([...event.dataTransfer.files], slot);
});

function sourceInput(index) {
  const prefix = `#source${index}-`;
  return {
    title: $(`${prefix}title`).value.trim(), effective: $(`${prefix}date`).value,
    url: $(`${prefix}url`).value.trim(), text: $(`${prefix}text`).value.trim()
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

$('#search-button').addEventListener('click', () => {
  status('#search-error', '');
  $('#search-results').hidden = true;
  const sources = [sourceInput(1), sourceInput(2)];
  const question = $('#question').value.trim();
  try {
    if (!question) throw new Error('가상 쟁점 질문을 먼저 입력해 주세요.');
    if (!sources.some((source) => source.text)) {
      throw new Error('제공 자료에서 확인 불가: 공식 링크만으로 원문을 자동으로 읽지 않습니다. 공개 조문 원문을 붙여넣어 주세요.');
    }
    if (sources.some((source) => source.text.length > 30000)) throw new Error('원문은 자료별 3만 자 이내로 입력해 주세요.');
    const results = findCandidates(question, sources);
    renderCandidates(results, sources);
    $('#search-results').hidden = false;
  } catch (error) { status('#search-error', error.message); }
});

function renderCandidates(candidates, sources) {
  $('#candidate-count').textContent = String(candidates.length);
  const list = $('#candidate-list');
  list.replaceChildren();
  if (!candidates.length) {
    list.append(el('div', 'no-match', sources.some((source) => source.text)
      ? '제공 자료에서 확인 불가 · 입력한 질문의 단어가 포함된 조문을 찾지 못했습니다. 다른 규정이나 표현도 담당자가 확인해 주세요.'
      : '제공 자료에서 확인 불가 · 원문을 입력해 주세요.'));
    return;
  }
  for (const item of candidates) {
    const card = el('article', 'candidate');
    const top = el('div', 'candidate-top');
    top.append(el('span', 'candidate-law', item.title), el('span', 'candidate-article', item.article));
    const excerpt = el('p', 'candidate-excerpt', item.excerpt);
    const meta = el('div', 'candidate-meta');
    for (const [label, value] of [
      ['시행일 (입력값)', item.effective], ['공식 링크 (입력값)', item.source],
      ['일치한 검색어', item.matched.join(', ') || '시효']
    ]) meta.append(el('strong', '', label), el('span', '', value));
    card.append(top, excerpt, meta, el('div', 'candidate-note', item.caveat));
    list.append(card);
  }
}

$('#calculate-button').addEventListener('click', () => {
  status('#calc-error', '');
  $('#calc-results').hidden = true;
  try {
    const start = $('#base-date').value;
    const includeFirst = document.querySelector('input[name="first-day"]:checked')?.value === 'include';
    const results = comparePeriods(start, includeFirst);
    const container = $('#date-results');
    container.replaceChildren();
    for (const result of results) {
      const card = el('div', 'date-card');
      card.append(el('span', '', `${result.title} · ${result.years}년`),
        el('strong', '', result.end), el('p', '', result.note));
      container.append(card);
    }
    $('#calc-footnote').textContent = `가상 입력일 ${start} · 계산 첫날 ${results[0].countedFrom} · ${includeFirst ? '초일 산입 가정' : '초일 불산입 가정'}. 민법 제160조의 월말 해당일 없는 경우만 단순 반영했으며, 공휴일/토요일·개별 사건의 기산점 및 변동사항은 반영하지 않았습니다.`;
    $('#calc-results').hidden = false;
  } catch (error) { status('#calc-error', error.message); }
});

const demoDate = el('button', 'btn btn-light date-demo', '예시 날짜로 체험');
demoDate.type = 'button';
$('#calculate-button').insertAdjacentElement('beforebegin', demoDate);
demoDate.addEventListener('click', () => {
  $('#base-date').value = '2026-01-01';
  $('#calculate-button').click();
});
