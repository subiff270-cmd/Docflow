"use client";

const USAGE_STORAGE_KEY = "docflow_daily_free_usage";
export const FREE_DAILY_MAX_QUOTA = 10;

interface StoredUsage {
  date: string;
  firstUsedAt: number;
  count: number;
}

const getTodayString = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

export const getClientDailyUsage = (): { count: number; hoursRemaining: number } => {
  if (typeof window === "undefined") {
    return { count: 0, hoursRemaining: 24 };
  }

  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    const now = Date.now();
    const today = getTodayString();

    if (!raw) {
      return { count: 0, hoursRemaining: 24 };
    }

    const data: StoredUsage = JSON.parse(raw);
    const elapsedMs = now - (data.firstUsedAt || now);
    const isExpired = elapsedMs >= 24 * 60 * 60 * 1000 || data.date !== today;

    if (isExpired) {
      // 24 hours have passed -> reset
      const fresh: StoredUsage = {
        date: today,
        firstUsedAt: now,
        count: 0,
      };
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(fresh));
      return { count: 0, hoursRemaining: 24 };
    }

    const hoursRemaining = Math.max(1, Math.ceil((24 * 60 * 60 * 1000 - elapsedMs) / (60 * 60 * 1000)));
    return { count: Math.max(0, data.count || 0), hoursRemaining };
  } catch (e) {
    return { count: 0, hoursRemaining: 24 };
  }
};

export const incrementClientDailyUsage = (): { count: number; hoursRemaining: number } => {
  if (typeof window === "undefined") {
    return { count: 1, hoursRemaining: 24 };
  }

  try {
    const current = getClientDailyUsage();
    const newCount = current.count + 1;
    const now = Date.now();
    const today = getTodayString();

    let firstUsedAt = now;
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.firstUsedAt && now - parsed.firstUsedAt < 24 * 60 * 60 * 1000) {
          firstUsedAt = parsed.firstUsedAt;
        }
      } catch (e) {}
    }

    const updated: StoredUsage = {
      date: today,
      firstUsedAt,
      count: newCount,
    };

    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("docflow_usage_updated"));
    return { count: newCount, hoursRemaining: current.hoursRemaining };
  } catch (e) {
    return { count: 1, hoursRemaining: 24 };
  }
};
