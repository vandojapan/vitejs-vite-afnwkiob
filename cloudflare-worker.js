const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const DEFAULT_TTL_SECONDS = 86400;

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  if (url.pathname === "/api/avatar") {
    return handleAvatar(request, url);
  }

  if (url.pathname === "/api/profile") {
    return handleProfile(request, url);
  }

  return jsonResponse({ error: "not found" }, 404);
}

async function handleAvatar(request, url) {
  const target = url.searchParams.get("target") || url.searchParams.get("query");
  if (!target) {
    return jsonResponse({ error: "target パラメータが必要です" }, 400);
  }

  const avatarUrl = buildUnavatarUrl(target);
  const upstreamRequest = new Request(avatarUrl, {
    method: "GET",
    headers: {
      Accept: "image/*",
      "User-Agent": "Mozilla/5.0 (compatible; Cloudflare Worker)",
    },
  });

  const response = await fetchWithCache(upstreamRequest, DEFAULT_TTL_SECONDS);
  return proxyResponse(response);
}

async function handleProfile(request, url) {
  const target = url.searchParams.get("url");
  if (!target) {
    return jsonResponse({ error: "url パラメータが必要です" }, 400);
  }

  let normalized;
  try {
    normalized = new URL(target).href;
  } catch (error) {
    return jsonResponse({ error: "正しい URL を指定してください" }, 400);
  }

  const pageRequest = new Request(normalized, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Cloudflare Worker)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  const pageResponse = await fetchWithCache(pageRequest, DEFAULT_TTL_SECONDS);
  if (!pageResponse.ok) {
    return jsonResponse({ error: "ページの取得に失敗しました" }, 502);
  }

  const html = await pageResponse.text();
  const metadata = extractMetadata(html);
  const profile = buildProfileData(normalized, metadata);
  const origin = new URL(request.url).origin;
  const avatarUrl = `${origin}/api/avatar?target=${encodeURIComponent(normalized)}`;

  return jsonResponse(
    {
      name: profile.name,
      displayName: profile.displayName,
      avatar: avatarUrl,
      provider: profile.provider,
      sourceUrl: normalized,
      ogTitle: metadata.ogTitle,
      ogImage: metadata.ogImage,
    },
    200
  );
}

function extractMetadata(html) {
  const ogTitle = extractMetaTag(html, ["og:title", "twitter:title"]);
  const ogImage = extractMetaTag(html, ["og:image", "twitter:image"]);
  const title = extractTagContent(html, "title");
  return { ogTitle, ogImage, title };
}

function extractMetaTag(html, names) {
  for (const name of names) {
    const pattern = new RegExp(`<meta\\s+(?:property|name)=[\"']${escapeRegExp(name)}[\"']\\s+content=[\"']([^\"']+)[\"']`, "i");
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function extractTagContent(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = html.match(pattern);
  return match?.[1]?.trim() || "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildProfileData(url, metadata) {
  const targetUrl = new URL(url);
  const providerData = parseProviderUrl(targetUrl);
  const displayName = metadata.ogTitle || metadata.title || providerData.identifier || targetUrl.hostname;
  const name = providerData.displayName || displayName;

  return {
    provider: providerData.provider,
    identifier: providerData.identifier,
    displayName,
    name,
  };
}

function parseProviderUrl(url) {
  const hostname = url.hostname.toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);

  if (hostname.endsWith("nicovideo.jp") && pathParts[0] === "user" && pathParts[1]) {
    return {
      provider: "nicovideo",
      identifier: pathParts[1],
      displayName: `nicovideo/${pathParts[1]}`,
    };
  }

  if (hostname.endsWith("twitter.com") && pathParts[0]) {
    return {
      provider: "twitter",
      identifier: pathParts[0],
      displayName: `@${pathParts[0]}`,
    };
  }

  if (hostname.endsWith("github.com") && pathParts[0]) {
    return {
      provider: "github",
      identifier: pathParts[0],
      displayName: pathParts[0],
    };
  }

  return {
    provider: hostname,
    identifier: url.href,
    displayName: hostname,
  };
}

function buildUnavatarUrl(target) {
  try {
    const url = new URL(target);
    const providerData = parseProviderUrl(url);
    if (providerData.provider === "nicovideo") {
      return `https://unavatar.io/nicovideo/${encodeURIComponent(providerData.identifier)}?fallback=identicon`;
    }
    if (providerData.provider === "twitter") {
      return `https://unavatar.io/twitter/${encodeURIComponent(providerData.identifier)}?fallback=identicon`;
    }
    if (providerData.provider === "github") {
      return `https://unavatar.io/github/${encodeURIComponent(providerData.identifier)}?fallback=identicon`;
    }
    return `https://unavatar.io/${encodeURIComponent(target)}?fallback=identicon`;
  } catch (error) {
    return `https://unavatar.io/${encodeURIComponent(target)}?fallback=identicon`;
  }
}

async function fetchWithCache(request, ttlSeconds) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);

  const responseForCache = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  if (response.ok) {
    await cache.put(cacheKey, responseForCache.clone());
  }

  return responseForCache;
}

function proxyResponse(response) {
  const resp = new Response(response.body, response);
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  return resp;
}

function jsonResponse(body, status = 200) {
  const headers = {
    "content-type": "application/json;charset=UTF-8",
    ...CORS_HEADERS,
  };
  return new Response(JSON.stringify(body), { status, headers });
}
