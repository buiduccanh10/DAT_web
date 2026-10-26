function toFiniteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getSessionDistanceMetrics(session, durationMinutes) {
  const rawDistance = toFiniteNumber(session.QuangDuong);
  const storedMorningDistance = toFiniteNumber(session.TotalMorningDistance) || 0;
  const storedEveningDistance = toFiniteNumber(session.TotalEveningDistance) || 0;
  const totalDistance = rawDistance === null
    ? storedMorningDistance + storedEveningDistance
    : rawDistance;
  const duration = Math.max(0, Number(durationMinutes) || 0);
  const storedEveningTime = toFiniteNumber(session.TotalEveningTime);
  const eveningTime = Math.min(
    duration,
    Math.max(
      0,
      storedEveningTime === null
        ? toFiniteNumber(session.ThoiGianBanDem) || 0
        : storedEveningTime
    )
  );

  if (rawDistance !== null && duration > 0) {
    const eveningDistance = (totalDistance * eveningTime) / duration;
    return {
      totalDistance,
      morningDistance: totalDistance - eveningDistance,
      eveningDistance,
    };
  }

  return {
    totalDistance,
    morningDistance: storedMorningDistance,
    eveningDistance: storedEveningDistance,
  };
}

function roundDistance(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

module.exports = { getSessionDistanceMetrics, roundDistance };
