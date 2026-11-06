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

function cleanFloat(val) {
  return Math.round(Number(val) * 1000000) / 1000000;
}

function parseDuration(duration) {
  if (duration === null || duration === undefined || duration === "") return 0;

  // File DAT mới: thời gian là số thập phân (giờ, vd 0.04, 1.5)
  if (typeof duration === "number") {
    return cleanFloat(duration * 60);
  }

  // File cũ / đã format: chuỗi "XhYY" (vd "1h30"), "1.5h", "1h30p" hoặc chuỗi thập phân "1.5"
  if (typeof duration === "string") {
    const trimmed = duration.trim();
    if (trimmed.includes("h")) {
      const [hoursString, minutesString] = trimmed.split("h");
      const cleanMin = (minutesString || "").trim().toLowerCase().replace("p", "");
      // Nếu có dạng "1.5h" hoặc không có số phút sau "h"
      if (hoursString.includes(".") || cleanMin === "") {
        const floatHours = parseFloat(hoursString);
        if (!isNaN(floatHours)) {
          return cleanFloat(floatHours * 60);
        }
      }
      const hours = parseInt(hoursString, 10) || 0;
      const minutes = parseInt(cleanMin, 10) || 0;
      return hours * 60 + minutes;
    } else {
      const parsedFloat = parseFloat(trimmed);
      if (!isNaN(parsedFloat)) {
        return cleanFloat(parsedFloat * 60);
      }
    }
  }

  return 0;
}

function formatTime(minutes) {
  if (minutes === null || minutes === undefined || minutes === "") {
    return "0h";
  }
  let mins;
  if (typeof minutes === "number") {
    mins = minutes;
  } else if (typeof minutes === "string" && !isNaN(Number(minutes))) {
    mins = Number(minutes);
  } else {
    mins = parseDuration(minutes);
  }
  if (!mins || isNaN(mins) || mins <= 0) {
    return "0h";
  }
  const rawHours = mins / 60;
  // Khử sai số dấu phẩy động IEEE-754 (vd 15.420000000000002 -> 15.42) mà không cắt bớt chữ số thập phân
  const hours = Math.round(rawHours * 1000000) / 1000000;
  return `${hours}h`;
}

module.exports = { getSessionDistanceMetrics, roundDistance, parseDuration, formatTime };
