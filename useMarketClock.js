import { useState, useEffect, useMemo } from 'react';

// Wall-clock utilities in exchange time (America/New_York), DST-safe.
const ET = 'America/New_York';

const getZonedParts = (date) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = {};
  fmt.formatToParts(date).forEach(({ type, value }) => {
    p[type] = value;
  });
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour: p.hour === '24' ? 0 : parseInt(p.hour, 10),
    minute: parseInt(p.minute, 10),
    second: parseInt(p.second, 10),
  };
};

// Convert an ET wall time (y, mo, d, h, mi) to a UTC timestamp, resolving
// the EST/EDT offset for that specific calendar date in two refinement passes.
const zonedTimeToUtc = (y, mo, d, h, mi) => {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ts = wall;
  for (let i = 0; i < 2; i++) {
    const p = getZonedParts(new Date(ts));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ts += wall - asUtc;
  }
  return ts;
};

const REGULAR_OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const REGULAR_CLOSE_MIN = 16 * 60; // 16:00 ET
const PREMARKET_OPEN_MIN = 4 * 60; // 04:00 ET

export const useMarketClock = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    const p = getZonedParts(new Date(now));
    const minutesOfDay = p.hour * 60 + p.minute;
    const etToday = new Date(Date.UTC(p.year, p.month - 1, p.day));
    const weekday = etToday.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekday = weekday !== 0 && weekday !== 6;

    let status = 'CLOSED';
    if (isWeekday && minutesOfDay >= PREMARKET_OPEN_MIN && minutesOfDay < REGULAR_OPEN_MIN) {
      status = 'PRE_MARKET';
    } else if (isWeekday && minutesOfDay >= REGULAR_OPEN_MIN && minutesOfDay < REGULAR_CLOSE_MIN) {
      status = 'OPEN';
    } else if (isWeekday && minutesOfDay >= REGULAR_CLOSE_MIN && minutesOfDay < REGULAR_CLOSE_MIN + 240) {
      status = 'AFTER_HOURS';
    }

    // Next regular-session open: scan the next 8 ET calendar days.
    let targetUtc = null;
    for (let i = 0; i <= 7 && targetUtc === null; i++) {
      const dayUtc = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
      const wd = dayUtc.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      const openTs = zonedTimeToUtc(dayUtc.getUTCFullYear(), dayUtc.getUTCMonth() + 1, dayUtc.getUTCDate(), 9, 30);
      if (openTs > now) targetUtc = openTs;
    }

    let countdownLabel = '--:--:--';
    if (targetUtc !== null) {
      let s = Math.max(0, Math.floor((targetUtc - now) / 1000));
      const h = Math.floor(s / 3600);
      s -= h * 3600;
      const m = Math.floor(s / 60);
      s -= m * 60;
      const pad = (n) => String(n).padStart(2, '0');
      countdownLabel = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    const nextOpenDay = targetUtc !== null ? getZonedParts(new Date(targetUtc)) : null;
    const nextOpenLabel =
      nextOpenDay !== null
        ? `${nextOpenDay.month}/${nextOpenDay.day} · 09:30 ET`
        : '—';

    return { status, countdownLabel, nextOpenLabel };
  }, [now]);
};
