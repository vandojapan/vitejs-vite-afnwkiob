const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const serviceToUnavatar = {
  x: "twitter",
  instagram: "instagram",
  youtube: "youtube",
  soundcloud: "soundcloud",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

const decodeHtml = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const extractMeta = (html, property) => {
  const escapedProperty = property.replace(":", "[:]");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapedProperty}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedProperty}["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${escapedProperty}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return "";
};

const extractTitle = (html) => {
  const ogTitle = extractMeta(html, "og:title");

  if (ogTitle) return ogTitle;

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
  return decodeHtml(title.trim());
};

const getHandle = (profileUrl) => {
  const url = new URL(profileUrl);
  const firstPathPart = url.pathname.split("/").filter(Boolean)[0] || "";

  if (url.hostname.includes("youtube.com") && firstPathPart.startsWith("@")) {
    return firstPathPart.slice(1);
  }

  return firstPathPart.replace(/^@/, "");
};

const getUnavatarUrl = (service, profileUrl) => {
  if (service === "niconico") return "";

  const provider = serviceToUnavatar[service];
  const handle = getHandle(profileUrl);

  if (!provider || !handle) return "";

  return `https://unavatar.io/${provider}/${encodeURIComponent(handle)}`;
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.pathname !== "/profile") {
      return json({ error: "Not found" }, 404);
    }

    const service = requestUrl.searchParams.get("service") || "";
    const profileUrl = requestUrl.searchParams.get("url") || "";

    if (!profileUrl) {
      return json({ error: "url is required" }, 400);
    }

    let parsedProfileUrl;

    try {
      parsedProfileUrl = new URL(profileUrl);
    } catch {
      return json({ error: "url is invalid" }, 400);
    }

    if (!["http:", "https:"].includes(parsedProfileUrl.protocol)) {
      return json({ error: "url must be http or https" }, 400);
    }

    const response = await fetch(parsedProfileUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EventNameCardBot/1.0; +https://workers.cloudflare.com/)",
      },
    });

    if (!response.ok) {
      return json({ error: `profile responded ${response.status}` }, 502);
    }

    const html = await response.text();
    const ogImage = extractMeta(html, "og:image");
    const name = extractTitle(html)
      .replace(/\s*[-|｜]\s*X\s*$/i, "")
      .replace(/\s*-\s*YouTube\s*$/i, "")
      .trim();

    return json({
      name,
      iconUrl: service === "niconico" ? ogImage : getUnavatarUrl(service, profileUrl),
      ogImage,
      sourceUrl: parsedProfileUrl.toString(),
    });
  },
};
