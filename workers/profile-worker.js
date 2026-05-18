const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const defaultFetchHeaders = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
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

const decodePathPart = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getHandle = (profileUrl) => {
  const url = new URL(profileUrl);
  const firstPathPart = url.pathname.split("/").filter(Boolean)[0] || "";

  if (url.hostname.includes("youtube.com") && firstPathPart.startsWith("@")) {
    return decodePathPart(firstPathPart.slice(1));
  }

  return decodePathPart(firstPathPart.replace(/^@/, ""));
};

const getProfileIdentifiers = (profileUrl, service) => {
  const url = new URL(profileUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const firstPathPart = pathParts[0] || "";
  const secondPathPart = pathParts[1] || "";
  const decodedSecondPathPart = decodePathPart(secondPathPart);
  const handle = getHandle(profileUrl);

  if (service === "x") {
    return {
      screenName: handle ? `@${handle}` : "",
      profileId: handle,
    };
  }

  if (service === "youtube") {
    if (firstPathPart.startsWith("@")) {
      return {
        screenName: handle ? `@${handle}` : "",
        profileId: handle,
      };
    }

    if (["channel", "user", "c"].includes(firstPathPart) && decodedSecondPathPart) {
      return {
        screenName: firstPathPart === "channel" ? "" : `@${decodedSecondPathPart}`,
        profileId: decodedSecondPathPart,
      };
    }

    return {
      screenName: "",
      profileId: handle,
    };
  }

  if (service === "niconico") {
    return {
      screenName: "",
      profileId:
        ["user", "users"].includes(firstPathPart) && /^\d+$/.test(secondPathPart)
          ? secondPathPart
          : handle,
    };
  }

  if (service === "soundcloud") {
    return {
      screenName: handle,
      profileId: handle,
    };
  }

  return {
    screenName: "",
    profileId: handle,
  };
};

const getProfileFetchUrl = (profileUrl, service) => {
  const url = new URL(profileUrl);

  if (service === "soundcloud") {
    const firstPathPart = url.pathname.split("/").filter(Boolean)[0] || "";

    if (firstPathPart) {
      url.pathname = `/${firstPathPart}`;
      url.search = "";
      url.hash = "";
    }
  }

  return url;
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
        "User-Agent": defaultFetchHeaders["User-Agent"],
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

const getXProfile = async (profileUrl) => {
  const handle = getHandle(profileUrl);

  if (!handle) {
    return { name: "", iconUrl: "" };
  }

  try {
    const response = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`,
      { headers: defaultFetchHeaders },
    );

    if (!response.ok) {
      return { name: "", iconUrl: "" };
    }

    const html = await response.text();
    const nextData = html.match(
      /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    )?.[1];

    if (!nextData) {
      return { name: "", iconUrl: "" };
    }

    const data = JSON.parse(nextData);
    const entries = data?.props?.pageProps?.timeline?.entries || [];
    const user = entries
      .map((entry) => entry?.content?.tweet?.user)
      .find((candidate) => candidate?.screen_name?.toLowerCase() === handle.toLowerCase());

    return {
      name: user?.name || "",
      iconUrl: "",
    };
  } catch {
    return { name: "", iconUrl: "" };
  }
};

const proxyImage = async (requestUrl) => {
  const imageUrl = requestUrl.searchParams.get("url") || "";

  if (!isAllowedRemoteUrl(imageUrl)) {
    return json({ error: "image url is invalid" }, 400);
  }

  const response = await fetch(imageUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": defaultFetchHeaders["User-Agent"],
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

    const fetchProfileUrl = getProfileFetchUrl(parsedProfileUrl.toString(), service);

    const response = await fetch(fetchProfileUrl.toString(), {
      headers: defaultFetchHeaders,
    });

    if (!response.ok) {
      return json({ error: `profile responded ${response.status}` }, 502);
    }

    const html = await response.text();
    const ogImage = extractMeta(html, "og:image");
    const xProfile =
      service === "x" ? await getXProfile(fetchProfileUrl.toString()) : { name: "", iconUrl: "" };
    const iconCandidates =
      service === "niconico"
        ? [ogImage]
        : [xProfile.iconUrl, ...getUnavatarUrls(service, fetchProfileUrl.toString()), ogImage];
    const rawIconUrl = await getFirstFetchableImageUrl(iconCandidates);
    const name = xProfile.name || cleanProfileName(extractTitle(html), service);
    const identifiers = getProfileIdentifiers(fetchProfileUrl.toString(), service);

    return json({
      name,
      ...identifiers,
      iconUrl: getProxyImageUrl(requestUrl, rawIconUrl),
      rawIconUrl,
      ogImage,
      sourceUrl: fetchProfileUrl.toString(),
    });
  },
};
