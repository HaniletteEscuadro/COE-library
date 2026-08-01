/**
 * User-agent parsing for the activity log.
 *
 * Deliberately dependency-free: pulling in `ua-parser-js` for this would add a
 * runtime dependency to something that runs on every single request. The order
 * of the checks matters a lot — most browsers lie about who they are for
 * backwards-compatibility reasons, so the more specific token has to win:
 *
 *   Edge  contains "Chrome" AND "Safari"   -> check Edge before Chrome
 *   Chrome contains "Safari"               -> check Chrome before Safari
 *   Opera contains "Chrome"                -> check Opera before Chrome
 *   Windows Phone contains "Android"       -> check Windows Phone before Android
 *
 * Parsing happens once at write time and the result is stored on the row, so
 * the dashboard never re-parses while rendering.
 */

export type ParsedUserAgent = {
  /** "Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown" */
  device: string;
  browser: string;
  os: string;
};

export const UNKNOWN_USER_AGENT: ParsedUserAgent = {
  device: "Unknown",
  browser: "Unknown",
  os: "Unknown",
};

/** Matched before anything else — crawlers should not look like real sign-ins. */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|headlesschrome|phantomjs|curl\/|wget\/|python-requests|axios\/|postman/i;

/** Ordered most-specific first; the first hit wins. */
const BROWSER_RULES: Array<{ name: string; test: RegExp; version?: RegExp }> = [
  { name: "Edge", test: /\bEdg(?:e|A|iOS)?\//, version: /\bEdg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Opera", test: /\bOPR\/|\bOpera\//, version: /\b(?:OPR|Opera)\/([\d.]+)/ },
  { name: "Samsung Internet", test: /SamsungBrowser\//, version: /SamsungBrowser\/([\d.]+)/ },
  { name: "Vivaldi", test: /\bVivaldi\//, version: /\bVivaldi\/([\d.]+)/ },
  { name: "Brave", test: /\bBrave\//, version: /\bBrave\/([\d.]+)/ },
  { name: "Firefox", test: /\bFirefox\/|\bFxiOS\//, version: /\b(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: "Chrome", test: /\bChrome\/|\bCriOS\//, version: /\b(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: "Safari", test: /\bSafari\//, version: /\bVersion\/([\d.]+)/ },
  { name: "Internet Explorer", test: /\bMSIE |\bTrident\//, version: /(?:MSIE |rv:)([\d.]+)/ },
];

const OS_RULES: Array<{ name: string; test: RegExp; version?: RegExp }> = [
  // Windows Phone must precede both Windows and Android.
  { name: "Windows Phone", test: /Windows Phone/ },
  { name: "Windows", test: /Windows NT/, version: /Windows NT ([\d.]+)/ },
  // iPadOS 13+ reports as "Macintosh", so iPad has to be checked first.
  { name: "iPadOS", test: /iPad/, version: /OS ([\d_]+)/ },
  { name: "iOS", test: /iPhone|iPod/, version: /OS ([\d_]+)/ },
  { name: "Android", test: /Android/, version: /Android ([\d.]+)/ },
  { name: "Chrome OS", test: /CrOS/ },
  { name: "macOS", test: /Mac OS X|Macintosh/, version: /Mac OS X ([\d_.]+)/ },
  { name: "Ubuntu", test: /Ubuntu/ },
  { name: "Linux", test: /Linux|X11/ },
];

/** Map the Windows NT kernel version to the marketing name people recognise. */
const WINDOWS_NT_NAMES: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.1": "XP",
};

function firstMatch(userAgent: string, pattern?: RegExp) {
  if (!pattern) return "";
  return userAgent.match(pattern)?.[1] ?? "";
}

/** "17_4_1" -> "17.4.1"; keeps only the first two segments to stay readable. */
function tidyVersion(raw: string) {
  if (!raw) return "";
  return raw.replace(/_/g, ".").split(".").slice(0, 2).join(".");
}

function detectBrowser(userAgent: string) {
  for (const rule of BROWSER_RULES) {
    if (!rule.test.test(userAgent)) continue;
    const version = tidyVersion(firstMatch(userAgent, rule.version));
    return version ? `${rule.name} ${version}` : rule.name;
  }
  return "Unknown";
}

function detectOs(userAgent: string) {
  for (const rule of OS_RULES) {
    if (!rule.test.test(userAgent)) continue;

    const rawVersion = firstMatch(userAgent, rule.version);

    if (rule.name === "Windows") {
      const label = WINDOWS_NT_NAMES[rawVersion];
      return label ? `Windows ${label}` : "Windows";
    }

    const version = tidyVersion(rawVersion);
    return version ? `${rule.name} ${version}` : rule.name;
  }
  return "Unknown";
}

function detectDevice(userAgent: string) {
  if (BOT_PATTERN.test(userAgent)) return "Bot";
  // "Android" without "Mobile" is the standard tablet signal.
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return "Tablet";
  if (/Mobi|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(userAgent)) {
    return "Mobile";
  }
  if (/Windows|Macintosh|Mac OS X|Linux|X11|CrOS/i.test(userAgent)) return "Desktop";
  return "Unknown";
}

/**
 * Parse a raw `user-agent` header into the three fields the activity log
 * stores. Never throws and never returns empty strings — an unparseable agent
 * still produces a complete, renderable row.
 */
export function parseUserAgent(userAgent?: string | null): ParsedUserAgent {
  const value = (userAgent ?? "").trim();

  if (!value || value === "Unknown client") {
    return { ...UNKNOWN_USER_AGENT };
  }

  // A malformed agent must not be able to take down a sign-in.
  try {
    return {
      device: detectDevice(value),
      browser: detectBrowser(value),
      os: detectOs(value),
    };
  } catch {
    return { ...UNKNOWN_USER_AGENT };
  }
}

/** Compact one-line form for tables: "Chrome 138 · Windows 10/11 · Desktop" */
export function describeUserAgent(userAgent?: string | null) {
  const { device, browser, os } = parseUserAgent(userAgent);
  return [browser, os, device].filter((part) => part && part !== "Unknown").join(" · ") || "Unknown device";
}
