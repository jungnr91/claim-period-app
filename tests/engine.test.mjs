import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePeriods, referenceEndDate, splitArticles, findCandidates, REFERENCES } from '../engine.mjs';

test('five- and ten-year results remain separate and are not legal conclusions', () => {
  const [state, civil] = comparePeriods('2026-01-01');
  assert.equal(state.years, 5);
  assert.equal(civil.years, 10);
  assert.equal(state.end, '2031-01-01');
  assert.equal(civil.end, '2036-01-01');
  assert.match(civil.note, /국가채권 적용 여부/);
  assert.match(REFERENCES[0].source, /law\.go\.kr/);
});

test('first day inclusion affects calendar reference end date', () => {
  assert.equal(referenceEndDate('2026-01-01', 10, false).end, '2036-01-01');
  assert.equal(referenceEndDate('2026-01-01', 10, true).end, '2035-12-31');
});

test('leap-day and absent corresponding date follow end-of-month fallback', () => {
  assert.equal(referenceEndDate('2024-02-29', 5, true).end, '2029-02-28');
  assert.equal(referenceEndDate('2024-02-29', 5, false).end, '2029-02-28');
  assert.equal(referenceEndDate('2024-02-28', 5, false).end, '2029-02-28');
});

test('reject invalid dates or out-of-range periods', () => {
  assert.throws(() => referenceEndDate('2026-02-30', 5), /유효한/);
  assert.throws(() => referenceEndDate('2026-01-01', 0), /정수/);
  assert.throws(() => referenceEndDate('', 5), /YYYY-MM-DD/);
});

const source = { title: '가상 공개법', effective: '2026-01-01', url: 'https://www.law.go.kr/example', text: '제1조(목적) 이 법은 예시를 위한 것이다.\n제2조(시효) 채권의 소멸시효 기간은 5년이다.' };

test('find only exact supplied article text and preserve metadata as user input', () => {
  const candidates = findCandidates('소멸시효 기간', [source]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].article, '제2조(시효)');
  assert.ok(source.text.includes(candidates[0].excerpt));
  assert.equal(candidates[0].effective, source.effective);
});

test('no documents or unrelated issue returns no made-up articles', () => {
  assert.deepEqual(findCandidates('소멸시효', []), []);
  assert.deepEqual(findCandidates('부동산 압류', [source]), []);
  assert.deepEqual(splitArticles('조문 형식이 없는 텍스트'), []);
});

test('different versions remain separate and unknown effective date stays unknown', () => {
  const versions = findCandidates('시효 기간', [source, { ...source, effective: '', text: source.text.replace('5년', '10년') }]);
  assert.equal(versions.length, 2);
  assert.equal(versions[1].effective, '시행일 확인 불가');
  assert.notEqual(versions[0].excerpt, versions[1].excerpt);
});

test('injected instructions are never executed as application code', () => {
  const hostile = { ...source, text: '제3조(시효) <script>throw new Error("bad")</script> 소멸시효' };
  const [result] = findCandidates('소멸시효', [hostile]);
  assert.match(result.excerpt, /<script>/);
});
