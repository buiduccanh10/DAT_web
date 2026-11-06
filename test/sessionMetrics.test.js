const assert = require("assert");
const {
  getSessionDistanceMetrics,
  roundDistance,
  formatTime,
  parseDuration,
} = require("../lib/sessionMetrics");

const rows = [
  [113.806, 165, 110],
  [162.119, 209, 0],
  [154.837, 196, 116],
  [84.257, 117, 0],
  [103.886, 121, 0],
  [101.741, 147, 0],
];

const total = rows.reduce((sum, [distance, duration, eveningTime]) => {
  return sum + getSessionDistanceMetrics(
    { QuangDuong: distance, TotalEveningTime: eveningTime },
    duration
  ).totalDistance;
}, 0);

assert.strictEqual(roundDistance(total), 720.646);
assert.strictEqual(
  roundDistance(
    getSessionDistanceMetrics(
      { QuangDuong: 113.806, TotalEveningTime: 110 },
      165
    ).morningDistance
  ),
  37.935
);

// formatTime test cases
assert.strictEqual(formatTime(90), "1.5h");
assert.strictEqual(formatTime(120), "2h");
assert.strictEqual(formatTime(0), "0h");
assert.strictEqual(formatTime(null), "0h");
assert.strictEqual(formatTime(""), "0h");
assert.strictEqual(formatTime("1h30"), "1.5h");
assert.strictEqual(formatTime("1h30p"), "1.5h");
assert.strictEqual(formatTime("1.5h"), "1.5h");
assert.strictEqual(formatTime(925.2), "15.42h");
assert.strictEqual(formatTime(926.04), "15.434h");
assert.strictEqual(formatTime(15.4345 * 60), "15.4345h");
assert.strictEqual(formatTime(65), "1.083333h");
assert.strictEqual(formatTime(105), "1.75h");

// parseDuration test cases
assert.strictEqual(parseDuration("1.5h"), 90);
assert.strictEqual(parseDuration("1h30"), 90);
assert.strictEqual(parseDuration("1h30p"), 90);
assert.strictEqual(parseDuration(1.5), 90);
assert.strictEqual(parseDuration("1.5"), 90);
assert.strictEqual(parseDuration(1.33), 79.8);
assert.strictEqual(parseDuration("1.33"), 79.8);
assert.strictEqual(parseDuration(0.36), 21.6);
assert.strictEqual(parseDuration("2h"), 120);
assert.strictEqual(parseDuration("0h"), 0);
assert.strictEqual(parseDuration("15.434h"), 926.04);

// Test accumulation of real sessions without rounding error
const realSessions = [1.1, 0.36, 0.8, 1.95, 1.33, 1.53, 3.57, 3.25, 1.53];
const totalDurationMinutes = realSessions.reduce((sum, h) => sum + parseDuration(h), 0);
assert.strictEqual(formatTime(totalDurationMinutes), "15.42h");

console.log("session metrics self-check passed");
