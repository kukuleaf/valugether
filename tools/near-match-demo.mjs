function evalCond(actual, target, op, tolerance) {
  const exact = op === 'LTE' ? actual <= target : actual >= target;
  if (exact) return 'EXACT';
  const delta = Math.abs(target) * tolerance;
  const distance = op === 'LTE' ? actual - target : target - actual;
  return distance >= 0 && distance <= delta ? 'NEAR' : 'FAIL';
}
const cases = [
  [14, 12, 'EXACT'],
  [16, 11, 'NEAR'],
  [14, 9.5, 'NEAR'],
  [16, 9.5, 'NEAR'],
  [17, 12, 'FAIL'],
  [14, 8, 'FAIL'],
];
let failed = 0;
for (const [per, roe, expected] of cases) {
  const statuses = [evalCond(per, 15, 'LTE', 0.1), evalCond(roe, 10, 'GTE', 0.1)];
  const actual = statuses.includes('FAIL')
    ? 'FAIL'
    : statuses.every((x) => x === 'EXACT')
      ? 'EXACT'
      : 'NEAR';
  console.log({ per, roe, expected, actual });
  if (actual !== expected) failed++;
}
if (failed) process.exit(1);
