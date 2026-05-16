import { useRef, useState } from "react";
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

const PROFILE_SERVICES = [
  { id: "x", label: "X" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "soundcloud", label: "SoundCloud" },
  { id: "niconico", label: "ニコニコ動画" },
];

function App() {
  const canvasRef = useRef(null);

  const [activeTab, setActiveTab] = useState("simple");
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
  const [iconImage, setIconImage] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({
    unit: "%",
    width: 80,
    aspect: 1,
  });
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
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
      endpoint.searchParams.set("url", trimmedUrl);
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
      const nextName = profile.name || profile.title || profile.displayName;
      const nextIconUrl =
        profile.iconUrl || profile.avatarUrl || profile.image || profile.icon;

      if (nextName) {
        setName(nextName);
      }

      let iconWarning = "";
      let appliedIconColor = false;

      if (nextIconUrl) {
        try {
          const image = await loadImage(nextIconUrl);
          const iconColor = getColorFromIcon(image);
          setIconImage(image);

          if (iconColor) {
            setBgColor(iconColor);
            appliedIconColor = true;
          }
        } catch (error) {
          iconWarning =
            error instanceof Error
              ? error.message
              : "アイコン画像を読み込めませんでした。";
        }
      }

      setQrUrl((current) => current || trimmedUrl);
      setStatusMessage(
        iconWarning
          ? `名前は反映しました。${iconWarning}`
          : appliedIconColor
            ? "名前とアイコンを反映し、アイコンから色を設定しました。"
            : "名前とアイコンを反映しました。",
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

  const drawColorBackground = (ctx, rect, position = "top") => {
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
    ctx.fillStyle = bgColor;
    ctx.fill();
  };

  const wrapText = (ctx, text, maxWidth, maxLines) => {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let currentLine = "";

    const pushLine = (line) => {
      if (lines.length < maxLines) {
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
            if (lines.length >= maxLines) break;
          } else {
            partial = next;
          }
        }
        if (lines.length < maxLines && partial) {
          currentLine = partial;
        }
      } else {
        pushLine(currentLine);
        currentLine = word;
        if (lines.length >= maxLines - 1) break;
      }
    }

    if (currentLine && lines.length < maxLines) {
      pushLine(currentLine);
    }

    if (lines.length > maxLines) {
      lines.length = maxLines;
    }

    return lines.map((line, index) => {
      if (index === lines.length - 1 && lines.length === maxLines && ctx.measureText(line).width > maxWidth) {
        let truncated = line;
        while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        return `${truncated}…`;
      }
      return line;
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
    const contrastTextColor = getContrastTextColor(bgColor);
    const centerX = x + width / 2;
    const nameYOffset = panelCount === 1 ? -60 : 0;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);

    drawColorBackground(ctx, backgroundRect, backgroundPosition);

    if (rotateContent) {
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-(x + width / 2), -(y + height / 2));
    }

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
      ctx.font = `bold ${Math.round(height * (isSinglePanel ? 0.095 : 0.115))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        name || "名無し",
        centerX,
        y + height * (isSinglePanel ? 0.78 : 0.8) + nameYOffset,
        width * 0.82,
      );
    } else {
      ctx.fillStyle = contrastTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(height * 0.16)}px sans-serif`;
      ctx.fillText(name || "名無し", centerX, y + height * 0.42 + nameYOffset, width * 0.82);

      if (subText.trim()) {
        ctx.fillStyle = "#000000";
        ctx.font = `${Math.round(height * 0.08)}px sans-serif`;
        const lineHeight = Math.round(height * 0.08 * 1.3);
        const maxWidth = width * 0.78;
        const lines = wrapText(ctx, subText, maxWidth, 2);
        const baseY = y + height * (5 / 6) + nameYOffset - (lineHeight * (lines.length - 1)) / 2;

        lines.forEach((line, index) => {
          ctx.fillText(line, centerX, baseY + index * lineHeight, maxWidth);
        });
      }
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

  const renderCard = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

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

    const faces = panelCount === 2 ? [0, 1] : [0];

    for (const index of faces) {
      const rect = getCardRect(selectedPaper, index);
      const trimMarks = showTrimMarks && !isBorderlessPaper;
      const backgroundRect = useCardStyle ? outsetRect(rect, BLEED_PX) : trimMarks ? outsetRect(rect, BLEED_PX) : rect;
      const backgroundPosition = useCardStyle
        ? "top"
        : isBorderlessPaper && panelCount === 2 && index === 0
        ? "bottom"
        : "top";

      await drawCardFace(ctx, rect, {
        backgroundRect,
        backgroundPosition,
        rotateContent: !useCardStyle && panelCount === 2 && index === 0,
        trimMarks,
        trimRect: rect,
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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setImageSrc(reader.result);
      setShowCropModal(true);

      const img = new Image();
      img.onload = () => {
        setIconImage(img);
      };
      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="control-pane">
          <header className="app-header">
            <p className="eyebrow">Event name card</p>
            <h1>イベント名札ジェネレーター</h1>
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
              <div className="segmented">
                {[1, 2].map((count) => (
                  <button
                    className={panelCount === count ? "is-active" : ""}
                    key={count}
                    onClick={() => setPanelCount(count)}
                    type="button"
                  >
                    {count}面
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="field-group radio-group">
              <legend className="field-label">トリムマーク</legend>
              <label className="radio-option">
                <input
                  checked={showTrimMarks}
                  name="trim-marks"
                  onChange={() => setShowTrimMarks(true)}
                  type="radio"
                />
                あり
              </label>
              <label className="radio-option">
                <input
                  checked={!showTrimMarks}
                  name="trim-marks"
                  onChange={() => setShowTrimMarks(false)}
                  type="radio"
                />
                なし
              </label>
            </fieldset>

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

          <nav className="tabs" aria-label="編集モード">
            <button
              className={activeTab === "simple" ? "is-active" : ""}
              onClick={() => setActiveTab("simple")}
              type="button"
            >
              シンプル
            </button>
            <button
              className={activeTab === "advanced" ? "is-active" : ""}
              onClick={() => setActiveTab("advanced")}
              type="button"
            >
              アドバンス
            </button>
          </nav>

          {activeTab === "simple" ? (
            <section className="panel tab-panel">
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
                className="app-button"
                disabled={isFetchingProfile}
                onClick={resolveProfile}
                type="button"
              >
                {isFetchingProfile ? "取得中..." : "取得して反映"}
              </button>

              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </section>
          ) : (
            <section className="panel tab-panel">
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

              {!iconImage && (
                <label className="field-group">
                  <span className="field-label">サブテキスト</span>
                  <input
                    onChange={(event) => setSubText(event.target.value)}
                    placeholder="サブテキスト"
                    type="text"
                    value={subText}
                  />
                </label>
              )}

              <label className="field-group">
                <span className="field-label">アイコン画像</span>
                <input accept="image/*" onChange={handleFileSelect} type="file" />
              </label>

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
        <div className="modal-backdrop">
          <div className="crop-modal">
            <h2>アイコンを調整</h2>

            <ReactCrop crop={crop} onChange={(nextCrop) => setCrop(nextCrop)} aspect={1}>
              <img alt="Crop" src={imageSrc} />
            </ReactCrop>

            <button
              className="app-button"
              onClick={() => setShowCropModal(false)}
              type="button"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
