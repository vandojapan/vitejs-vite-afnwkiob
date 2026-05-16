const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const serviceToUnavatarProviders = {
  x: ["x", "twitter"],
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

const isAllowedRemoteUrl = (value) => {
  let url;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return ["http:", "https:"].includes(url.protocol);
};

const getProxyImageUrl = (requestUrl, imageUrl) => {
  if (!imageUrl) return "";

  const proxyUrl = new URL("/image", requestUrl.origin);
  proxyUrl.searchParams.set("url", imageUrl);

  return proxyUrl.toString();
};

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

const cleanProfileName = (title, service) => {
  if (service === "x") {
    return title
      .replace(/\s*\(@[^)]+\)\s*on\s*X\s*$/i, "")
      .replace(/\s*[-|｜]\s*X\s*$/i, "")
      .trim();
  }

  if (service === "youtube") {
    return title.replace(/\s*-\s*YouTube\s*$/i, "").trim();
  }

  if (service === "soundcloud") {
    return title.replace(/\s*\|\s*Listen on SoundCloud\s*$/i, "").trim();
  }

  if (service === "niconico") {
    return title.replace(/\s*-\s*ニコニコ\s*$/i, "").trim();
  }

  return title.trim();
};

const getHandle = (profileUrl) => {
  const url = new URL(profileUrl);
  const firstPathPart = url.pathname.split("/").filter(Boolean)[0] || "";

  if (url.hostname.includes("youtube.com") && firstPathPart.startsWith("@")) {
    return firstPathPart.slice(1);
  }

  return firstPathPart.replace(/^@/, "");
};

const getUnavatarUrls = (service, profileUrl) => {
  if (service === "niconico") return [];

  const providers = serviceToUnavatarProviders[service];
  const handle = getHandle(profileUrl);

  if (!providers || !handle) return [];

  return [providers]
    .flat()
    .map(
      (provider) =>
        `https://unavatar.io/${provider}/${encodeURIComponent(handle)}`,
    );
};

const isFetchableImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; EventNameCardImageProbe/1.0; +https://workers.cloudflare.com/)",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  }
};

const getFirstFetchableImageUrl = async (imageUrls) => {
  for (const imageUrl of imageUrls.filter(Boolean)) {
    if (await isFetchableImage(imageUrl)) {
      return imageUrl;
    }
  }

  return "";
};

const proxyImage = async (requestUrl) => {
  const imageUrl = requestUrl.searchParams.get("url") || "";

  if (!isAllowedRemoteUrl(imageUrl)) {
    return json({ error: "image url is invalid" }, 400);
  }

  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; EventNameCardImageProxy/1.0; +https://workers.cloudflare.com/)",
    },
  });

  if (!response.ok) {
    return json({ error: `image responded ${response.status}` }, 502);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";

  if (!contentType.startsWith("image/")) {
    return json({ error: "remote url did not return an image" }, 415);
  }

  return new Response(response.body, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=86400",
      "Content-Type": contentType,
    },
  });
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === "/image") {
      return proxyImage(requestUrl);
    }

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
    const iconCandidates =
      service === "niconico"
        ? [ogImage]
        : [...getUnavatarUrls(service, profileUrl), ogImage];
    const rawIconUrl = await getFirstFetchableImageUrl(iconCandidates);
    const name = cleanProfileName(extractTitle(html), service);

    return json({
      name,
      iconUrl: getProxyImageUrl(requestUrl, rawIconUrl),
      rawIconUrl,
      ogImage,
      sourceUrl: parsedProfileUrl.toString(),
    });
  },
};
