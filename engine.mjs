export const REFERENCES = Object.freeze([
  {
    title: '국가재정법 제96조 제1항',
    years: 5,
    effective: '2026-09-11',
    source: 'https://www.law.go.kr/LSW/lsLinkProc.do?chrClsCd=010202&datClsCd=010102&gubun=admRul&joNo=009600002&lsId=34956&lsNm=%EA%B5%AD%EA%B0%80%EC%9E%AC%EC%A0%95%EB%B2%95&mode=10',
    note: '다른 법률에 시효 규정이 없는 국가의 금전채권에 관한 조항. 실제 해당 여부는 판단하지 않습니다.'
  },
  {
    title: '민법 제162조 제1항',
    years: 10,
    effective: '2026-03-17',
    source: 'https://www.law.go.kr/lsLinkProc.do?joNo=016200&lsNm=%EB%AF%BC%EB%B2%95&mode=11',
    note: '일반 채권 10년 규정. 국가채권 적용 여부는 별도 확인해야 합니다.'
  }
]);

function dateParts(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('기준일을 YYYY-MM-DD 형식으로 입력해 주세요.');
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2090 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('유효한 기준일을 입력해 주세요 (1900~2090년).');
  }
  return { year, month, day, date };
}

function iso(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) { return new Date(date.getTime() + days * 86_400_000); }

// Calendar illustration only: start-day inclusion and section 160(3) end-of-month fallback.
export function referenceEndDate(startDate, years, includeFirstDay = false) {
  const start = dateParts(startDate);
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error('기간은 1~50년의 정수로 입력해 주세요.');
  const counted = includeFirstDay ? start.date : addDays(start.date, 1);
  const targetYear = counted.getUTCFullYear() + years;
  const month = counted.getUTCMonth();
  const day = counted.getUTCDate();
  const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  const end = day > lastDay
    ? new Date(Date.UTC(targetYear, month, lastDay))
    : addDays(new Date(Date.UTC(targetYear, month, day)), -1);
  return { start: startDate, countedFrom: iso(counted), years, includeFirstDay, end: iso(end) };
}

export function comparePeriods(startDate, includeFirstDay = false) {
  return REFERENCES.map((reference) => ({ ...reference, ...referenceEndDate(startDate, reference.years, includeFirstDay) }));
}

// Only exact excerpts supplied by the user can be shown as evidence candidates.
export function splitArticles(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const pattern = /(?:^|\n)\s*(제\d+조(?:의\d+)?(?:\s*제\d+항)?(?:\([^\n)]{0,80}\))?)/g;
  const matches = [...source.matchAll(pattern)];
  if (!matches.length) return [];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const end = next ? next.index : source.length;
    return { article: match[1].trim(), text: source.slice(start, end).trim() };
  });
}

const STOPWORDS = new Set(['관련', '해당', '관한', '대한', '무엇', '어떤', '찾아', '주세요', '채권', '규정', '조항', '법령', '시효', '가상', '질문', '에서', '있는', '알려', '어떻게']);
export function findCandidates(question, sources) {
  const query = String(question ?? '').trim();
  if (!query) throw new Error('가상의 시효 쟁점 질문을 입력해 주세요.');
  if (query.length > 300) throw new Error('가상 질문은 300자 이내로 입력해 주세요.');
  const words = [...new Set((query.match(/[가-힣A-Za-z0-9]+/g) || []).map((word) => word.toLowerCase()))]
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  const candidates = [];
  for (const source of sources) {
    if (!source || !String(source.text ?? '').trim()) continue;
    const articles = splitArticles(source.text);
    for (const article of articles) {
      const lower = article.text.toLowerCase();
      const matched = words.filter((word) => lower.includes(word));
      // When a question only asks about prescription in general, allow explicit '시효' matches.
      if (!matched.length && (words.length || !/시효/.test(query) || !lower.includes('시효'))) continue;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(source.effective || '') ? source.effective : '시행일 확인 불가';
      candidates.push({
        question: query,
        title: String(source.title || '').trim() || '법령명 미입력',
        article: article.article,
        excerpt: article.text.slice(0, 600),
        effective: date,
        source: String(source.url || '').trim() || '출처 링크 미입력',
        matched,
        caveat: '입력한 원문에서 찾은 문자열 후보입니다. 공식 원문·시행일·적용 여부는 담당자가 확인해야 합니다.'
      });
    }
  }
  return candidates.sort((a, b) => b.matched.length - a.matched.length).slice(0, 20);
}
