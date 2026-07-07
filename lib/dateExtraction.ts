import * as chrono from "chrono-node";

export interface ExtractedDate {
  date: Date | null;
  matchedText: string | null;
  method: "chrono" | "sa-fallback" | "lone-number-fallback" | "none";
}

/** Current date/time in Asia/Manila, used as the reference point for parsing. */
function getManilaNow(): Date {
  const now = new Date();
  const manilaString = now.toLocaleString("en-US", { timeZone: "Asia/Manila" });
  return new Date(manilaString);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Extracts a booking date from raw guest text, e.g.
 * "may available po kayo sa july 10?" -> July 10 (current/next year as appropriate)
 * "avail po kayo sa 10"               -> the 10th of the current month (or next month if 10 already passed)
 * "meron ba kayo bukas"               -> tomorrow (chrono handles relative terms too)
 */
export function extractDateFromText(rawText: string): ExtractedDate {
  const referenceDate = getManilaNow();

  // 1. Try chrono first — it finds date-like substrings ("july 10", "7/10", "07-10-2026",
  //    "10th of july", "next friday", "bukas"/"tomorrow" via English relative terms, etc.)
  //    and ignores the Tagalog filler words around them.
  const results = chrono.parse(rawText, referenceDate, { forwardDate: true });

  if (results.length > 0) {
    const best = results[0];
    return {
      date: best.start.date(),
      matchedText: best.text,
      method: "chrono",
    };
  }

  // 2. Fallback: "sa 10", "sa10" style — day only, no month mentioned.
  //    Assume current month; if that day has already passed, roll to next month.
  const saMatch = rawText.match(/\bsa\s*(\d{1,2})\b/i);
  const loneNumberMatch = rawText.match(/\b(\d{1,2})\b/);
  const dayNum = saMatch
    ? parseInt(saMatch[1], 10)
    : loneNumberMatch
    ? parseInt(loneNumberMatch[1], 10)
    : null;

  if (dayNum && dayNum >= 1 && dayNum <= 31) {
    let year = referenceDate.getFullYear();
    let month = referenceDate.getMonth(); // 0-indexed
    let candidate = new Date(year, month, dayNum);

    // Guard against invalid dates (e.g. day 31 in a 30-day month)
    if (candidate.getDate() !== dayNum) {
      return { date: null, matchedText: null, method: "none" };
    }

    if (startOfDay(candidate) < startOfDay(referenceDate)) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      candidate = new Date(year, month, dayNum);
      if (candidate.getDate() !== dayNum) {
        return { date: null, matchedText: null, method: "none" };
      }
    }

    return {
      date: candidate,
      matchedText: saMatch ? saMatch[0] : loneNumberMatch![0],
      method: saMatch ? "sa-fallback" : "lone-number-fallback",
    };
  }

  return { date: null, matchedText: null, method: "none" };
}
