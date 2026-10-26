const assert = require("assert");
const {
  getSessionDistanceMetrics,
  roundDistance,
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

console.log("session metrics self-check passed");
