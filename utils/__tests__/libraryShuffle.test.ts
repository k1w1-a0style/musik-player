import { shuffleItems } from '../libraryShuffle';

test('returns a new array without mutating the input', () => {
  const input = [1, 2, 3];
  const result = shuffleItems(input, () => 0);

  expect(result).not.toBe(input);
  expect(input).toEqual([1, 2, 3]);
});

test('uses fisher-yates indices deterministically', () => {
  const randomValues = [0.1, 0.9, 0.2];
  const result = shuffleItems(['a', 'b', 'c', 'd'], () => randomValues.shift() ?? 0);

  expect(result).toEqual(['c', 'b', 'd', 'a']);
});

test('handles empty and single-item arrays', () => {
  expect(shuffleItems([])).toEqual([]);
  expect(shuffleItems(['only'])).toEqual(['only']);
});
