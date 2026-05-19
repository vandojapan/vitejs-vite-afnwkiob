import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { TwitterPicker } from "react-color";
import ReactCrop from "react-image-crop";

import "react-image-crop/dist/ReactCrop.css";
import "./App.css";

const PROFILE_WORKER_URL = import.meta.env.VITE_PROFILE_WORKER_URL || "";
const PRINT_DPI = 300;
const BLEED_PX = Math.round((3 / 25.4) * PRINT_DPI);
const CARD_WIDTH = Math.round((91 / 25.4) * PRINT_DPI);
const CARD_HEIGHT = Math.round((55 / 25.4) * PRINT_DPI);

const PAPER_SIZES = {
  postcard: {
    label: "ハガキ",
    width: 1181,
    height: 1748,
    previewWidth: 360,
  },
  photo: {
    label: "L版",
    width: 1051,
    height: 1500,
    previewWidth: 350,
  },
  card: {
    label: "カード",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    previewWidth: 280,
  },
};

const FONT_FAMILIES = [
  { id: "default", label: "デフォルト", css: "sans-serif", supports700: false },
  { id: "DotGothic16", label: "DotGothic16", css: "'DotGothic16', sans-serif", supports700: false },
  { id: "IBM Plex Sans", label: "IBM Plex Sans", css: "'IBM Plex Sans', sans-serif", supports700: true },
  { id: "RocknRoll One", label: "RocknRoll One", css: "'RocknRoll One', sans-serif", supports700: false },
  { id: "Kaisei Decol", label: "Kaisei Decol", css: "'Kaisei Decol', sans-serif", supports700: true },
  { id: "Kaisei HarunoUmi", label: "Kaisei HarunoUmi", css: "'Kaisei HarunoUmi', sans-serif", supports700: true },
  { id: "Kaisei Opti", label: "Kaisei Opti", css: "'Kaisei Opti', sans-serif", supports700: true },
  { id: "Kosugi Maru", label: "Kosugi Maru", css: "'Kosugi Maru', sans-serif", supports700: false },
  { id: "Kosugi", label: "Kosugi", css: "'Kosugi', sans-serif", supports700: false },
];

const PROFILE_SERVICES = [
  { id: "x", label: "X" },
  { id: "github", label: "GitHub" },
  { id: "youtube", label: "YouTube" },
  { id: "soundcloud", label: "SoundCloud" },
  { id: "niconico", label: "ニコニコ動画" },
];

const ONBOARDING_STORAGE_KEY = "event-namecard-onboarding-seen";
const MODAL_EXIT_MS = 180;

const ONBOARDING_SLIDES = [
  {
    title: "シンプルモード",
    text: "URLを入れるだけで、自動で作成します。",
    image: "/card1.png",
  },
  {
    title: "アドバンスモード",
    text: "画像、色、フォント、サブテキストを自由にカスタマイズできます。",
    image: "/card2.png",
  },
  {
    title: "ギャラリーに保存",
    text: "生成した名札はそのまま印刷に使えます。コンビニプリントもOK。",
    image: "/card3.png",
  },
];

const formatProfileSubText = (profile, service) => {
  if (service === "github") {
    return "";
  }

  if (service === "niconico") {
    return /^\d+$/.test(profile.profileId || "") ? profile.profileId : "";
  }

  if (service === "soundcloud") {
    return profile.profileId || profile.handle || getProfileHandle(profile);
  }

  const candidates = [
    profile.screenName,
    profile.handle,
    profile.username,
    getProfileHandle(profile) ? `@${getProfileHandle(profile)}` : "",
  ].filter(Boolean);

  const screenName = candidates.find((value) => value.startsWith("@"));

  if (screenName) {
    return screenName;
  }

  return "";
};

const getProfileHandle = (profile) => {
  const handle =
    profile.profileId
    || profile.handle
    || profile.username
    || profile.screenName
    || "";

  if (handle) {
    return handle.replace(/^@/, "");
  }

  if (!profile.sourceUrl) {
    return "";
  }

  try {
    const url = new URL(profile.sourceUrl);
    const firstPathPart = url.pathname.split("/").filter(Boolean)[0] || "";

    return decodeURIComponent(firstPathPart.replace(/^@/, ""));
  } catch {
    return "";
  }
};

const getFallbackProfileName = (profile, service) => {
  if (service !== "x") {
    return "";
  }

  return getProfileHandle(profile);
};

const getFallbackIconUrls = (profile, service) => {
  const handle = getProfileHandle(profile);

  if (service !== "x" || !handle) {
    return [];
  }

  return [
    `https://unavatar.io/x/${encodeURIComponent(handle)}`,
    `https://unavatar.io/twitter/${encodeURIComponent(handle)}`,
  ];
};

const normalizeProfileUrlInput = (value, service) => {
  const trimmed = value.trim();

  if (service === "youtube" && !/^https?:\/\//i.test(trimmed)) {
    const handle = trimmed.replace(/^@/, "");

    if (handle && !/[/?#]/.test(handle)) {
      return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    }
  }

  if (service !== "x") {
    return trimmed;
  }

  const handle = trimmed.replace(/^@/, "");

  if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return `https://x.com/${handle}`;
  }

  return trimmed;
};

const normalizeFontFamily = (cssFontFamily) => {
  const family = cssFontFamily.split(",")[0].trim();
  return family.replace(/^['"]+|['"]+$/g, "");
};

const ensureFontLoaded = async (cssFontFamily, sampleText = "名無しサブテキスト") => {
  if (typeof document === "undefined" || !document.fonts || !document.fonts.load) {
    return;
  }

  const normalized = normalizeFontFamily(cssFontFamily);
  const sample = sampleText.trim() || "名無しサブテキスト";

  if (!normalized || normalized.toLowerCase() === "sans-serif") {
    return;
  }

  const selectedFont = FONT_FAMILIES.find((font) => font.css === cssFontFamily);
  const requests = [document.fonts.load(`400 1em "${normalized}"`, sample)];

  if (selectedFont?.supports700) {
    requests.push(document.fonts.load(`700 1em "${normalized}"`, sample));
  }

  try {
    await Promise.all(requests);
    await document.fonts.ready;
  } catch {
    // ignore font loading failures and render with fallback
  }
};

function App() {
  const canvasRef = useRef(null);
  const cropImageRef = useRef(null);
  const iconInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("simple");
  const [previousTab, setPreviousTab] = useState("simple");
  const [paperSize, setPaperSize] = useState("photo");
  const [useCardStyle, setUseCardStyle] = useState(false);
  const [panelCount, setPanelCount] = useState(1);
  const [showTrimMarks, setShowTrimMarks] = useState(true);
  const [profileService, setProfileService] = useState("x");
  const [profileUrl, setProfileUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [name, setName] = useState("");
  const [subText, setSubText] = useState("");
  const [bgColor, setBgColor] = useState("#333333");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].css);
  const [iconImage, setIconImage] = useState(null);
  const [iconFileName, setIconFileName] = useState("");
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [backgroundFileName, setBackgroundFileName] = useState("");
  const [backgroundBlur, setBackgroundBlur] = useState(0);

  useEffect(() => {
    ensureFontLoaded(fontFamily);
  }, [fontFamily]);
  const [imageSrc, setImageSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState("icon");
  const [cropAspect, setCropAspect] = useState(1);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isCropModalClosing, setIsCropModalClosing] = useState(false);
  const [crop, setCrop] = useState({
    unit: "%",
    width: 80,
    height: 80,
    x: 10,
    y: 10,
    aspect: 1,
  });
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const [isOnboardingClosing, setIsOnboardingClosing] = useState(false);
  const [onboardingSlide, setOnboardingSlide] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const selectedPaper = PAPER_SIZES[paperSize];
  const isBorderlessPaper = !useCardStyle && (paperSize === "photo" || paperSize === "postcard");

  const outsetRect = (rect, outset) => ({
    x: rect.x - outset,
    y: rect.y - outset,
    width: rect.width + outset * 2,
    height: rect.height + outset * 2,
  });

  const getContrastTextColor = (hex) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 186 ? "#000000" : "#ffffff";
  };

  const getContrastTextColorFromImage = (image) => {
    const sampleSize = 32;
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

    if (!sampleCtx) {
      return getContrastTextColor(bgColor);
    }

    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;

    try {
      sampleCtx.drawImage(image, 0, 0, sampleSize, sampleSize);

      const { data } = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
      let weightedBrightness = 0;
      let totalAlpha = 0;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] / 255;

        if (alpha <= 0) continue;

        const brightness =
          data[index] * 0.299
          + data[index + 1] * 0.587
          + data[index + 2] * 0.114;

        weightedBrightness += brightness * alpha;
        totalAlpha += alpha;
      }

      if (totalAlpha === 0) {
        return getContrastTextColor(bgColor);
      }

      return weightedBrightness / totalAlpha > 150 ? "#000000" : "#ffffff";
    } catch {
      return getContrastTextColor(bgColor);
    }
  };

  const rgbToHsl = (r, g, b) => {
    const normalizedR = r / 255;
    const normalizedG = g / 255;
    const normalizedB = b / 255;
    const max = Math.max(normalizedR, normalizedG, normalizedB);
    const min = Math.min(normalizedR, normalizedG, normalizedB);
    const lightness = (max + min) / 2;

    if (max === min) {
      return { hue: 0, saturation: 0, lightness };
    }

    const delta = max - min;
    const saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;

    if (max === normalizedR) {
      hue = (normalizedG - normalizedB) / delta + (normalizedG < normalizedB ? 6 : 0);
    } else if (max === normalizedG) {
      hue = (normalizedB - normalizedR) / delta + 2;
    } else {
      hue = (normalizedR - normalizedG) / delta + 4;
    }

    return {
      hue: hue * 60,
      saturation,
      lightness,
    };
  };

  const rgbToHex = (r, g, b) =>
    `#${[r, g, b]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;

  const getColorFromIcon = (image) => {
    const sampleSize = 64;
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    const sourceSize = Math.min(image.width, image.height);
    const sx = (image.width - sourceSize) / 2;
    const sy = (image.height - sourceSize) / 2;
    const colorBuckets = new Map();

    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;

    sampleCtx.drawImage(
      image,
      sx,
      sy,
      sourceSize,
      sourceSize,
      0,
      0,
      sampleSize,
      sampleSize,
    );

    try {
      const { data } = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];

        if (alpha < 180) continue;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const { saturation, lightness } = rgbToHsl(r, g, b);

        if (saturation < 0.18 || lightness < 0.18 || lightness > 0.88) {
          continue;
        }

        const bucketR = Math.round(r / 24) * 24;
        const bucketG = Math.round(g / 24) * 24;
        const bucketB = Math.round(b / 24) * 24;
        const key = `${bucketR},${bucketG},${bucketB}`;
        const current = colorBuckets.get(key) || {
          count: 0,
          r: 0,
          g: 0,
          b: 0,
          score: 0,
        };

        current.count += 1;
        current.r += r;
        current.g += g;
        current.b += b;
        current.score += saturation * (1 - Math.abs(lightness - 0.52));
        colorBuckets.set(key, current);
      }

      const bestColor = [...colorBuckets.values()].sort(
        (a, b) => b.count * b.score - a.count * a.score,
      )[0];

      if (!bestColor) {
        return "";
      }

      return rgbToHex(
        Math.round(bestColor.r / bestColor.count),
        Math.round(bestColor.g / bestColor.count),
        Math.round(bestColor.b / bestColor.count),
      );
    } catch {
      return "";
    }
  };

  const applyIconColor = () => {
    if (!iconImage) {
      setStatusMessage("先にアイコン画像を設定してください。");
      return;
    }

    const nextColor = getColorFromIcon(iconImage);

    if (nextColor) {
      setBgColor(nextColor);
      setStatusMessage(`アイコンから色を設定しました: ${nextColor}`);
    } else {
      setStatusMessage(
        "アイコンから使いやすい色を見つけられませんでした。CORS制約がある場合はWorkerの画像プロキシ経由で取得してください。",
      );
    }
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => {
        reject(new Error(`アイコン画像を読み込めませんでした: ${src}`));
      };
      image.src = src;
    });

  const resolveProfile = async () => {
    const trimmedUrl = profileUrl.trim();
    const normalizedProfileUrl = normalizeProfileUrlInput(trimmedUrl, profileService);

    if (!trimmedUrl) {
      setStatusMessage("プロフィールURLを入力してください。");
      return;
    }

    if (!PROFILE_WORKER_URL) {
      setStatusMessage(
        "VITE_PROFILE_WORKER_URL に Cloudflare Worker のURLを設定してください。",
      );
      return;
    }

    setIsFetchingProfile(true);
    setStatusMessage("プロフィールを取得しています...");

    try {
      const endpoint = new URL(PROFILE_WORKER_URL);
      endpoint.searchParams.set("url", normalizedProfileUrl);
      endpoint.searchParams.set("service", profileService);

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Worker responded ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const responseText = await response.text();

      if (!contentType.includes("application/json")) {
        const isHtml = responseText.trim().startsWith("<!doctype")
          || responseText.trim().startsWith("<html");

        throw new Error(
          isHtml
            ? "Worker URLがHTMLを返しています。.env の VITE_PROFILE_WORKER_URL がViteアプリや存在しないパスを指していないか確認してください。"
            : "Worker response is not JSON",
        );
      }

      const profile = JSON.parse(responseText);
      const nextName =
        profile.name
        || profile.title
        || profile.displayName
        || getFallbackProfileName(profile, profileService);
      const iconCandidates = [
        profile.iconUrl,
        profile.avatarUrl,
        profile.image,
        profile.icon,
        ...getFallbackIconUrls(profile, profileService),
      ].filter(Boolean);
      const nextSubText = formatProfileSubText(profile, profileService);

      if (nextName) {
        setName(nextName);
      }

      if (nextSubText) {
        setSubText(nextSubText);
      }

      let iconWarning = "";
      let appliedIconColor = false;

      for (const iconUrl of iconCandidates) {
        try {
          const image = await loadImage(iconUrl);
          const iconColor = getColorFromIcon(image);
          setIconImage(image);

          if (iconColor) {
            setBgColor(iconColor);
            appliedIconColor = true;
          }

          iconWarning = "";
          break;
        } catch (error) {
          iconWarning =
            error instanceof Error
              ? error.message
              : "アイコン画像を読み込めませんでした。";
        }
      }

      setQrUrl((current) => current || profile.sourceUrl || normalizedProfileUrl);
      setStatusMessage(
        iconWarning
          ? `名前とプロフィール情報を反映しました。${iconWarning}`
          : appliedIconColor
            ? "名前、プロフィール情報、アイコンを反映し、アイコンから色を設定しました。"
            : "名前、プロフィール情報、アイコンを反映しました。",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "詳細不明のエラー";

      setStatusMessage(
        `取得に失敗しました。WorkerのCORS設定とレスポンス形式を確認してください。(${errorMessage})`,
      );
    } finally {
      setIsFetchingProfile(false);
    }
  };

  const getCardRect = (paper, index) => {
    if (isBorderlessPaper) {
      return {
        x: 0,
        y: panelCount === 2 ? (paper.height / 2) * index : 0,
        width: paper.width,
        height: panelCount === 2 ? paper.height / 2 : paper.height,
      };
    }

    const gutter = Math.round(Math.min(paper.width, paper.height) * 0.045);

    if (useCardStyle) {
      const availableWidth = paper.width - gutter * 2;
      const availableHeight =
        panelCount === 2
          ? (paper.height - gutter * 3) / 2
          : paper.height - gutter * 2;
      const cardAspect = CARD_WIDTH / CARD_HEIGHT;
      let cardWidth = CARD_WIDTH;
      let cardHeight = CARD_HEIGHT;

      if (cardWidth > availableWidth) {
        cardWidth = availableWidth;
        cardHeight = Math.round(cardWidth / cardAspect);
      }

      if (cardHeight > availableHeight) {
        cardHeight = availableHeight;
        cardWidth = Math.round(cardHeight * cardAspect);
      }

      const x = (paper.width - cardWidth) / 2;
      const y =
        panelCount === 2
          ? gutter + index * (availableHeight + gutter) + (availableHeight - cardHeight) / 2
          : (paper.height - cardHeight) / 2;

      return {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
      };
    }

    const availableWidth = paper.width - gutter * 2;
    const availableHeight =
      panelCount === 2
        ? (paper.height - gutter * 3) / 2
        : paper.height - gutter * 2;

    const cardAspect = 3 / 2;
    let cardWidth = availableWidth;
    let cardHeight = cardWidth / cardAspect;

    if (cardHeight > availableHeight) {
      cardHeight = availableHeight;
      cardWidth = cardHeight * cardAspect;
    }

    const x = (paper.width - cardWidth) / 2;
    const y =
      panelCount === 2
        ? gutter + index * (availableHeight + gutter)
        : (paper.height - cardHeight) / 2;

    return {
      x,
      y,
      width: cardWidth,
      height: cardHeight,
    };
  };

  const drawTrimMarks = (ctx, x, y, w, h) => {
    const trim = BLEED_PX;

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;

    [
      [x - trim, y, x, y, x, y - trim, x, y],
      [x + w + trim, y, x + w, y, x + w, y - trim, x + w, y],
      [x - trim, y + h, x, y + h, x, y + h + trim, x, y + h],
      [x + w + trim, y + h, x + w, y + h, x + w, y + h + trim, x + w, y + h],
    ].forEach(([x1, y1, x2, y2, x3, y3, x4, y4]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    });
  };

  const drawQrCode = async (ctx, text, x, y, size) => {
    if (!text.trim()) return;

    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, text.trim(), {
      margin: 1,
      width: Math.round(size),
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(qrCanvas, x, y, size, size);
  };

  const traceBackgroundShape = (ctx, rect, position = "top") => {
    const { x, y, width, height } = rect;

    ctx.beginPath();

    if (position === "bottom") {
      ctx.moveTo(x, y + height);
      ctx.lineTo(x, y + height * 0.5);
      ctx.quadraticCurveTo(
        x + width / 2,
        y + height * 0.3,
        x + width,
        y + height * 0.5,
      );
      ctx.lineTo(x + width, y + height);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height * 0.5);
      ctx.quadraticCurveTo(
        x + width / 2,
        y + height * 0.7,
        x + width,
        y + height * 0.5,
      );
      ctx.lineTo(x + width, y);
    }

    ctx.closePath();
  };

  const getCoverImageRect = (image, rect) => {
    const imageAspect = image.width / image.height;
    const rectAspect = rect.width / rect.height;
    let sourceWidth = image.width;
    let sourceHeight = image.height;
    let sx = 0;
    let sy = 0;

    if (imageAspect > rectAspect) {
      sourceWidth = image.height * rectAspect;
      sx = (image.width - sourceWidth) / 2;
    } else {
      sourceHeight = image.width / rectAspect;
      sy = (image.height - sourceHeight) / 2;
    }

    return {
      sx,
      sy,
      sourceWidth,
      sourceHeight,
    };
  };

  const getBackgroundCropAspect = () => {
    const rect = getCardRect(selectedPaper, 0);
    const trimMarks = showTrimMarks && !isBorderlessPaper;
    const backgroundRect = useCardStyle
      ? outsetRect(rect, BLEED_PX)
      : trimMarks
      ? outsetRect(rect, BLEED_PX)
      : rect;

    return backgroundRect.width / backgroundRect.height;
  };

  const getCenteredCrop = (aspect) => {
    const cropWidth = aspect >= 1 ? 80 : Math.max(20, Math.round(80 * aspect));
    const cropHeight = aspect >= 1 ? Math.max(20, Math.round(80 / aspect)) : 80;

    return {
      unit: "%",
      width: cropWidth,
      height: cropHeight,
      x: (100 - cropWidth) / 2,
      y: (100 - cropHeight) / 2,
      aspect,
    };
  };

  const drawColorBackground = (ctx, rect, position = "top") => {
    traceBackgroundShape(ctx, rect, position);
    ctx.fillStyle = bgColor;
    ctx.fill();
  };

  const drawBackgroundImage = (ctx, image, rect, position = "top") => {
    const { x, y, width, height } = rect;
    const { sx, sy, sourceWidth, sourceHeight } = getCoverImageRect(image, rect);
    const blur = Number(backgroundBlur) || 0;
    const blurOutset = blur * 2;

    ctx.save();
    traceBackgroundShape(ctx, rect, position);
    ctx.clip();
    ctx.filter = blur > 0 ? `blur(${blur}px)` : "none";
    ctx.drawImage(
      image,
      sx,
      sy,
      sourceWidth,
      sourceHeight,
      x - blurOutset,
      y - blurOutset,
      width + blurOutset * 2,
      height + blurOutset * 2,
    );
    ctx.restore();
  };

  const wrapText = (ctx, text, maxWidth) => {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let currentLine = "";

    const pushLine = (line) => {
      if (line) {
        lines.push(line);
      }
    };

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (!currentLine) {
        let partial = "";
        for (const char of word) {
          const next = `${partial}${char}`;
          if (ctx.measureText(next).width > maxWidth) {
            pushLine(partial);
            partial = char;
          } else {
            partial = next;
          }
        }
        if (partial) {
          currentLine = partial;
        }
      } else {
        pushLine(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      pushLine(currentLine);
    }

    return lines;
  };

  const drawSubText = (ctx, text, centerX, baseY, options) => {
    const displayText = text.trim().slice(0, 40);

    if (!displayText) return;

    const {
      color = "#000000",
      fontSize,
      fontWeight,
      maxLines,
      maxWidth,
    } = options;
    const minFontSize = Math.max(10, fontSize * 0.55);
    let adjustedFontSize = fontSize;

    const setSubTextFont = () => {
      ctx.font = `${fontWeight} ${Math.round(adjustedFontSize)}px ${fontFamily}`;
    };

    const getLines = () => {
      if (maxLines === 1) {
        return [displayText];
      }

      return wrapText(ctx, displayText, maxWidth);
    };

    setSubTextFont();
    let lines = getLines();

    while (
      adjustedFontSize > minFontSize
      && (
        lines.length > maxLines
        || lines.some((line) => ctx.measureText(line).width > maxWidth)
      )
    ) {
      adjustedFontSize -= 1;
      setSubTextFont();
      lines = getLines();
    }

    const lineHeight = Math.round(adjustedFontSize * 1.3);
    const firstLineY = baseY - (lineHeight * (lines.length - 1)) / 2;

    ctx.fillStyle = color;
    setSubTextFont();

    lines.forEach((line, index) => {
      ctx.fillText(line, centerX, firstLineY + index * lineHeight);
    });
  };

  const drawCardFace = async (ctx, rect, options = {}) => {
    const { x, y, width, height } = rect;
    const {
      backgroundPosition = "top",
      backgroundRect = rect,
      rotateContent = false,
      trimMarks = true,
      trimRect = rect,
    } = options;
    const contrastTextColor = backgroundImage
      ? getContrastTextColorFromImage(backgroundImage)
      : getContrastTextColor(bgColor);
    const centerX = x + width / 2;
    const nameYOffset = panelCount === 1 || panelCount === 2 ? -60 : 0;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);

    if (backgroundImage) {
      drawBackgroundImage(ctx, backgroundImage, backgroundRect, backgroundPosition);
    } else {
      drawColorBackground(ctx, backgroundRect, backgroundPosition);
    }

    if (rotateContent) {
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-(x + width / 2), -(y + height / 2));
    }

    const selectedFont = FONT_FAMILIES.find((font) => font.css === fontFamily);
    const fontWeight = selectedFont?.supports700 ? "bold" : "normal";

    if (iconImage) {
      const isSinglePanel = panelCount === 1;
      const imageSize = Math.min(
        width * (isSinglePanel ? 0.44 : 0.32),
        height * (isSinglePanel ? 0.48 : 0.5),
      );
      const imageCenterY =
        y + height * (isSinglePanel ? 0.34 : 1 / 3);
      const sourceSize = Math.min(iconImage.width, iconImage.height);
      const sx = (iconImage.width - sourceSize) / 2;
      const sy = (iconImage.height - sourceSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, imageCenterY, imageSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        iconImage,
        sx,
        sy,
        sourceSize,
        sourceSize,
        centerX - imageSize / 2,
        imageCenterY - imageSize / 2,
        imageSize,
        imageSize,
      );
      ctx.restore();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(8, width * 0.012);
      ctx.beginPath();
      ctx.arc(centerX, imageCenterY, imageSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#111111";
      ctx.font = `${fontWeight} ${Math.round(height * (isSinglePanel ? 0.095 : 0.115))}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        name || "名無し",
        centerX,
        y + height * (isSinglePanel ? 0.78 : 0.8) + nameYOffset,
        width * 0.82,
      );

      drawSubText(ctx, subText, centerX, y + height * (isSinglePanel ? 0.9 : 0.92) + nameYOffset, {
        color: "#334155",
        fontSize: height * (isSinglePanel ? 0.045 : 0.055),
        fontWeight,
        maxLines: isSinglePanel ? 1 : 2,
        maxWidth: width * (isSinglePanel ? 0.86 : 0.76),
      });
    } else {
      const isSinglePanel = panelCount === 1;

      ctx.fillStyle = contrastTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${fontWeight} ${Math.round(height * 0.16)}px ${fontFamily}`;
      ctx.fillText(name || "名無し", centerX, y + height * 0.42 + nameYOffset, width * 0.82);

      drawSubText(ctx, subText, centerX, y + height * (5 / 6) + nameYOffset, {
        color: "#000000",
        fontSize: height * 0.08,
        fontWeight,
        maxLines: isSinglePanel ? 1 : 2,
        maxWidth: width * (isSinglePanel ? 0.88 : 0.78),
      });
    }

    await drawQrCode(
      ctx,
      qrUrl,
      x + width - height * 0.2,
      y + height - height * 0.2,
      height * 0.15,
    );

    if (rotateContent) {
      ctx.restore();
    }

    if (trimMarks) {
      drawTrimMarks(
        ctx,
        trimRect.x,
        trimRect.y,
        trimRect.width,
        trimRect.height,
      );
    }
  };

  const getCardFaceOptions = (rect, index) => {
    const trimMarks = showTrimMarks && !isBorderlessPaper;
    const backgroundRect = useCardStyle
      ? outsetRect(rect, BLEED_PX)
      : trimMarks
      ? outsetRect(rect, BLEED_PX)
      : rect;
    const backgroundPosition = useCardStyle
      ? "top"
      : isBorderlessPaper && panelCount === 2 && index === 0
      ? "bottom"
      : "top";

    return {
      backgroundRect,
      backgroundPosition,
      trimMarks,
      trimRect: rect,
    };
  };

  const translateRect = (rect, dx, dy) => ({
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height,
  });

  const drawMirroredTwoPanelFaces = async (ctx) => {
    const topRect = getCardRect(selectedPaper, 0);
    const bottomRect = getCardRect(selectedPaper, 1);
    const bottomOptions = getCardFaceOptions(bottomRect, 1);
    const topOptions = getCardFaceOptions(topRect, 0);
    const bottomCaptureRect = bottomOptions.backgroundRect;
    const topCaptureRect = topOptions.backgroundRect;
    const faceCanvas = document.createElement("canvas");
    const faceCtx = faceCanvas.getContext("2d");

    if (!faceCtx) {
      await drawCardFace(ctx, topRect, {
        ...topOptions,
        rotateContent: true,
      });
      await drawCardFace(ctx, bottomRect, bottomOptions);
      return;
    }

    faceCanvas.width = Math.ceil(bottomCaptureRect.width);
    faceCanvas.height = Math.ceil(bottomCaptureRect.height);

    await drawCardFace(
      faceCtx,
      translateRect(bottomRect, -bottomCaptureRect.x, -bottomCaptureRect.y),
      {
        backgroundRect: translateRect(
          bottomOptions.backgroundRect,
          -bottomCaptureRect.x,
          -bottomCaptureRect.y,
        ),
        backgroundPosition: bottomOptions.backgroundPosition,
        trimMarks: bottomOptions.trimMarks,
        trimRect: translateRect(bottomOptions.trimRect, -bottomCaptureRect.x, -bottomCaptureRect.y),
      },
    );

    ctx.drawImage(faceCanvas, bottomCaptureRect.x, bottomCaptureRect.y);

    ctx.save();
    ctx.translate(
      topCaptureRect.x + topCaptureRect.width / 2,
      topCaptureRect.y + topCaptureRect.height / 2,
    );
    ctx.rotate(Math.PI);
    ctx.drawImage(
      faceCanvas,
      -topCaptureRect.width / 2,
      -topCaptureRect.height / 2,
      topCaptureRect.width,
      topCaptureRect.height,
    );
    ctx.restore();
  };

  const renderCard = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    await ensureFontLoaded(fontFamily, `${name || "名無し"} ${subText}`);

    canvas.width = selectedPaper.width;
    canvas.height = selectedPaper.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (panelCount === 2) {
      ctx.strokeStyle = "#cbd5e1";
      ctx.setLineDash([16, 12]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(selectedPaper.width * 0.08, selectedPaper.height / 2);
      ctx.lineTo(selectedPaper.width * 0.92, selectedPaper.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (panelCount === 2 && !useCardStyle) {
      await drawMirroredTwoPanelFaces(ctx);
      return;
    }

    const faces = panelCount === 2 ? [0, 1] : [0];

    for (const index of faces) {
      const rect = getCardRect(selectedPaper, index);
      const faceOptions = getCardFaceOptions(rect, index);

      await drawCardFace(ctx, rect, {
        ...faceOptions,
        rotateContent: !useCardStyle && panelCount === 2 && index === 0,
      });
    }
  };

  const saveCard = async () => {
    await renderCard();

    const canvas = canvasRef.current;
    const link = document.createElement("a");

    link.download = "event-namecard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const shareCard = async () => {
    await renderCard();

    const canvas = canvasRef.current;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    if (!blob) {
      setStatusMessage("画像の準備に失敗しました。再試行してください。");
      return;
    }

    const file = new File([blob], "event-namecard.png", { type: "image/png" });
    const shareData = {
      title: "イベント名札",
      text: "作成した名札を共有します。",
      files: [file],
    };

    if (
      navigator.share &&
      (typeof navigator.canShare === "undefined" || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share(shareData);
        setStatusMessage("共有が完了しました。");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatusMessage("共有に失敗しました。別の方法をお試しください。");
        }
      }
      return;
    }

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ [file.type]: blob }),
        ]);
        setStatusMessage("画像をクリップボードにコピーしました。貼り付けて共有できます。");
      } catch {
        setStatusMessage("共有に対応していないブラウザです。PNG保存してください。");
      }
      return;
    }

    setStatusMessage("このブラウザは画像共有に対応していません。PNG保存してください。");
  };

  const openCropModal = (source, target) => {
    const aspect = target === "background" ? getBackgroundCropAspect() : 1;

    cropImageRef.current = null;
    setCropTarget(target);
    setCropAspect(aspect);
    setCrop(getCenteredCrop(aspect));
    setImageSrc(source);
    setIsCropModalClosing(false);
    setShowCropModal(true);
  };

  const closeCropModal = () => {
    setIsCropModalClosing(true);
    window.setTimeout(() => {
      setShowCropModal(false);
      setIsCropModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  const createCroppedImage = (sourceImage, percentCrop, aspect) =>
    new Promise((resolve, reject) => {
      const sourceWidth = sourceImage.naturalWidth;
      const sourceHeight = sourceImage.naturalHeight;
      const cropX = Math.min(100, Math.max(0, percentCrop.x || 0));
      const cropY = Math.min(100, Math.max(0, percentCrop.y || 0));
      const cropWidth = Math.min(100 - cropX, Math.max(1, percentCrop.width || 100));
      const fallbackHeight = (cropWidth / aspect / sourceHeight) * sourceWidth;
      const cropHeight = Math.min(
        100 - cropY,
        Math.max(1, percentCrop.height || fallbackHeight),
      );
      const sx = (cropX / 100) * sourceWidth;
      const sy = (cropY / 100) * sourceHeight;
      const sw = (cropWidth / 100) * sourceWidth;
      const sh = (cropHeight / 100) * sourceHeight;
      const canvas = document.createElement("canvas");
      const outputWidth = Math.max(1, Math.round(sw));
      const outputHeight = Math.max(1, Math.round(sh));

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("切り抜き画像を作成できませんでした。"));
        return;
      }

      ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("切り抜き画像を作成できませんでした。"));
      img.src = canvas.toDataURL("image/png");
    });

  const applyCrop = async () => {
    const sourceImage = cropImageRef.current;

    if (!sourceImage) {
      closeCropModal();
      return;
    }

    try {
      const croppedImage = await createCroppedImage(sourceImage, crop, cropAspect);

      if (cropTarget === "background") {
        setBackgroundImage(croppedImage);
        setStatusMessage(
          `背景画像を${panelCount === 2 ? "2面" : "1面"}用の比率で設定しました。`,
        );
      } else {
        setIconImage(croppedImage);
      }

      closeCropModal();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "画像の切り抜きに失敗しました。",
      );
    }
  };

  const clearIconImage = () => {
    setIconImage(null);
    setIconFileName("");

    if (iconInputRef.current) {
      iconInputRef.current.value = "";
    }
  };

  const clearBackgroundImage = () => {
    setBackgroundImage(null);
    setBackgroundFileName("");

    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = "";
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setIconFileName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      openCropModal(reader.result, "icon");
    };

    reader.readAsDataURL(file);
  };

  const handleBackgroundFileSelect = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setBackgroundFileName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      openCropModal(reader.result, "background");
    };

    reader.readAsDataURL(file);
  };

  const closeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // ignore storage failures
    }

    setIsOnboardingClosing(true);
    window.setTimeout(() => {
      setShowOnboarding(false);
      setIsOnboardingClosing(false);
    }, MODAL_EXIT_MS);
  };

  const openOnboarding = () => {
    setOnboardingSlide(0);
    setIsOnboardingClosing(false);
    setShowOnboarding(true);
  };

  const switchTab = (nextTab) => {
    if (nextTab === activeTab) return;

    setPreviousTab(activeTab);
    setActiveTab(nextTab);
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="control-pane">
          <header className="app-header">
            <div>
              <p className="eyebrow">Event name card</p>
              <h1>イベント名札ジェネレーター</h1>
            </div>
            <button
              aria-label="初回ガイドを表示"
              className="help-button"
              onClick={openOnboarding}
              type="button"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 512 512"
              >
                <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24v-13.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1h-58.3c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0a32 32 0 1 1 -64 0z" />
              </svg>
            </button>
          </header>

          <section className="panel">
            <h2>共通メニュー</h2>

            <div className="field-group">
              <span className="field-label">サイズ</span>
              <div className="segmented">
                {Object.entries(PAPER_SIZES)
                  .filter(([id]) => id !== "card")
                  .map(([id, paper]) => (
                    <button
                      className={paperSize === id ? "is-active" : ""}
                      key={id}
                      onClick={() => setPaperSize(id)}
                      type="button"
                    >
                      {paper.label}
                    </button>
                  ))}
              </div>
            </div>

            <label className="field-group checkbox-field">
              <input
                checked={useCardStyle}
                onChange={(event) => setUseCardStyle(event.target.checked)}
                type="checkbox"
              />
              <span>カードにする</span>
            </label>

            <div className="field-group">
              <span className="field-label">面数</span>
              <button
                aria-checked={panelCount === 2}
                className="panel-count-switch"
                data-panel-count={panelCount}
                onClick={() => setPanelCount((current) => (current === 1 ? 2 : 1))}
                role="switch"
                type="button"
              >
                <span className="panel-count-switch-indicator" aria-hidden="true" />
                <span className={panelCount === 1 ? "is-active" : ""}>1面</span>
                <span className={panelCount === 2 ? "is-active" : ""}>2面</span>
              </button>
            </div>

            {useCardStyle && (
              <label className="field-group checkbox-field trim-mark-field">
                <input
                  checked={showTrimMarks}
                  onChange={(event) => setShowTrimMarks(event.target.checked)}
                  type="checkbox"
                />
                <span>トリムマークを表示</span>
              </label>
            )}

            <label className="field-group">
              <span className="field-label">QRコード用URL</span>
              <input
                onChange={(event) => setQrUrl(event.target.value)}
                placeholder="https://example.com/profile"
                type="url"
                value={qrUrl}
              />
            </label>
          </section>

          <nav
            className="tabs"
            aria-label="編集モード"
            data-active-tab={activeTab}
          >
            <span className="tab-indicator" aria-hidden="true" />
            <button
              className={activeTab === "simple" ? "is-active" : ""}
              onClick={() => switchTab("simple")}
              type="button"
            >
              シンプル
            </button>
            <button
              className={activeTab === "advanced" ? "is-active" : ""}
              onClick={() => switchTab("advanced")}
              type="button"
            >
              アドバンス
            </button>
          </nav>

          {activeTab === "simple" ? (
            <section
              className="panel tab-panel"
              data-direction={previousTab === "advanced" ? "backward" : "forward"}
              key="simple"
            >
              <h2>プロフィールから自動入力</h2>

              <div className="field-group">
                <span className="field-label">サービス</span>
                <div className="service-grid">
                  {PROFILE_SERVICES.map((service) => (
                    <button
                      className={profileService === service.id ? "is-active" : ""}
                      key={service.id}
                      onClick={() => setProfileService(service.id)}
                      type="button"
                    >
                      {service.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field-group">
                <span className="field-label">プロフィールURL</span>
                <input
                  onChange={(event) => setProfileUrl(event.target.value)}
                  placeholder="プロフィールページのURL"
                  type="url"
                  value={profileUrl}
                />
              </label>

              <button
                className="app-button fetch-profile-button"
                disabled={isFetchingProfile}
                onClick={resolveProfile}
                type="button"
              >
                {isFetchingProfile ? "取得中..." : "取得して反映"}
              </button>

              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </section>
          ) : (
            <section
              className="panel tab-panel"
              data-direction={previousTab === "simple" ? "forward" : "backward"}
              key="advanced"
            >
              <h2>手動設定</h2>

              <label className="field-group">
                <span className="field-label">名前</span>
                <input
                  onChange={(event) => setName(event.target.value)}
                  placeholder="名前を入力"
                  type="text"
                  value={name}
                />
              </label>

              <label className="field-group">
                <span className="field-label">サブテキスト</span>
                <input
                  onChange={(event) => setSubText(event.target.value)}
                  placeholder="サブテキスト"
                  type="text"
                  value={subText}
                />
              </label>

              <label className="field-group">
                <span className="field-label">フォント</span>
                <select
                  value={fontFamily}
                  onChange={(event) => setFontFamily(event.target.value)}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.id} value={font.css}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-group">
                <span className="field-label">アイコン画像</span>
                <div className="file-input-row">
                  <div className="file-picker-stack">
                    <label className="file-select-button" htmlFor="icon-image-input">
                      ファイルを選択
                    </label>
                    <input
                      accept="image/*"
                      className="file-picker-input"
                      id="icon-image-input"
                      onChange={handleFileSelect}
                      ref={iconInputRef}
                      type="file"
                    />
                    <span className="file-name">
                      {iconFileName || "選択されていません"}
                    </span>
                  </div>
                  {iconImage && (
                    <button
                      aria-label="アイコン画像を削除"
                      className="clear-file-button"
                      onClick={clearIconImage}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4L13.4 12l5.3 5.3-1.4 1.4L12 13.4l-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">背景画像</span>
                <div className="file-input-row">
                  <div className="file-picker-stack">
                    <label className="file-select-button" htmlFor="background-image-input">
                      ファイルを選択
                    </label>
                    <input
                      accept="image/*"
                      className="file-picker-input"
                      id="background-image-input"
                      onChange={handleBackgroundFileSelect}
                      ref={backgroundInputRef}
                      type="file"
                    />
                    <span className="file-name">
                      {backgroundFileName || "選択されていません"}
                    </span>
                  </div>
                  {backgroundImage && (
                    <button
                      aria-label="背景画像を削除"
                      className="clear-file-button"
                      onClick={clearBackgroundImage}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        focusable="false"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4L13.4 12l5.3 5.3-1.4 1.4L12 13.4l-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">背景画像ぼかし</span>
                <div className="range-row">
                  <input
                    disabled={!backgroundImage}
                    max="32"
                    min="0"
                    onChange={(event) => setBackgroundBlur(Number(event.target.value))}
                    type="range"
                    value={backgroundBlur}
                  />
                  <span>{backgroundBlur}px</span>
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">色設定</span>
                <div className="color-actions">
                  <button
                    className="color-chip"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    style={{ backgroundColor: bgColor }}
                    type="button"
                  >
                    {bgColor}
                  </button>
                  <button
                    className="utility-button"
                    disabled={!iconImage}
                    onClick={applyIconColor}
                    type="button"
                  >
                    アイコンから自動
                  </button>
                </div>
              </div>

              {showColorPicker && (
                <div className="color-picker">
                  <TwitterPicker
                    color={bgColor}
                    onChange={(color) => setBgColor(color.hex)}
                  />
                </div>
              )}
            </section>
          )}

          <div className="actions">
            <button className="app-button" onClick={renderCard} type="button">
              生成
            </button>
            <button className="app-button secondary" onClick={saveCard} type="button">
              PNG保存
            </button>
            <button className="app-button secondary" onClick={shareCard} type="button">
              共有
            </button>
          </div>
        </div>

        <section className="preview-pane">
          <canvas
            className="preview-canvas"
            height={selectedPaper.height}
            ref={canvasRef}
            style={{ width: `${selectedPaper.previewWidth}px` }}
            width={selectedPaper.width}
          />
        </section>
      </section>

      {showCropModal && imageSrc && (
        <div className={`modal-backdrop${isCropModalClosing ? " is-closing" : ""}`}>
          <div className="crop-modal modal-surface">
            <h2>{cropTarget === "background" ? "背景画像を調整" : "アイコンを調整"}</h2>

            <ReactCrop
              aspect={cropAspect}
              crop={crop}
              onChange={(_, nextPercentCrop) => setCrop(nextPercentCrop)}
            >
              <img
                alt="Crop"
                onLoad={(event) => {
                  cropImageRef.current = event.currentTarget;
                }}
                src={imageSrc}
              />
            </ReactCrop>

            <button
              className="app-button"
              onClick={applyCrop}
              type="button"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className={`modal-backdrop${isOnboardingClosing ? " is-closing" : ""}`}>
          <section
            aria-label="初回ガイド"
            className="onboarding-modal modal-surface"
          >
            <div
              className="onboarding-track"
              style={{ transform: `translateX(-${onboardingSlide * 100}%)` }}
            >
              {ONBOARDING_SLIDES.map((slide, index) => (
                <article className="onboarding-slide" key={slide.title}>
                  <div className="onboarding-image-frame">
                    <img alt="" src={slide.image} />
                  </div>

                  <div className="onboarding-copy">
                    <p className="onboarding-step">
                      {index + 1} / {ONBOARDING_SLIDES.length}
                    </p>
                    <h2>{slide.title}</h2>
                    <p>{slide.text}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="onboarding-footer">
              <div className="onboarding-dots" aria-hidden="true">
                {ONBOARDING_SLIDES.map((slide, index) => (
                  <span
                    className={onboardingSlide === index ? "is-active" : ""}
                    key={slide.title}
                  />
                ))}
              </div>

              {onboardingSlide < ONBOARDING_SLIDES.length - 1 ? (
                <button
                  className="app-button"
                  onClick={() => setOnboardingSlide((current) => current + 1)}
                  type="button"
                >
                  次へ
                </button>
              ) : (
                <button
                  className="app-button"
                  onClick={closeOnboarding}
                  type="button"
                >
                  閉じる
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
