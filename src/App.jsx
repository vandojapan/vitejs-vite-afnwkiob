import { useRef, useState } from "react";
import QRCode from "qrcode";
import { TwitterPicker } from "react-color";
import ReactCrop from "react-image-crop";

import "react-image-crop/dist/ReactCrop.css";
import "./App.css";

const PROFILE_WORKER_URL = import.meta.env.VITE_PROFILE_WORKER_URL || "";

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
    width: 1011,
    height: 638,
    previewWidth: 430,
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
  const [panelCount, setPanelCount] = useState(1);
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

  const getContrastTextColor = (hex) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 186 ? "#000000" : "#ffffff";
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

      if (nextIconUrl) {
        try {
          const image = await loadImage(nextIconUrl);
          setIconImage(image);
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
    const gutter = Math.round(Math.min(paper.width, paper.height) * 0.045);
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
    const trim = 30;

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

  const drawCardFace = async (ctx, rect) => {
    const { x, y, width, height } = rect;
    const contrastTextColor = getContrastTextColor(bgColor);
    const centerX = x + width / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height * 0.55);
    ctx.quadraticCurveTo(
      x + width / 2,
      y + height * 0.85,
      x + width,
      y + height * 0.55,
    );
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();

    if (iconImage) {
      const imageSize = Math.min(width * 0.32, height * 0.5);
      const sourceSize = Math.min(iconImage.width, iconImage.height);
      const sx = (iconImage.width - sourceSize) / 2;
      const sy = (iconImage.height - sourceSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, y + height * 0.36, imageSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        iconImage,
        sx,
        sy,
        sourceSize,
        sourceSize,
        centerX - imageSize / 2,
        y + height * 0.36 - imageSize / 2,
        imageSize,
        imageSize,
      );
      ctx.restore();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(8, width * 0.012);
      ctx.beginPath();
      ctx.arc(centerX, y + height * 0.36, imageSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#111111";
      ctx.font = `bold ${Math.round(height * 0.115)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name || "名無し", centerX, y + height * 0.83);
    } else {
      ctx.fillStyle = contrastTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(height * 0.16)}px sans-serif`;
      ctx.fillText(name || "名無し", centerX, y + height * 0.42, width * 0.82);

      ctx.font = `${Math.round(height * 0.08)}px sans-serif`;
      ctx.fillText(subText || "", centerX, y + height * 0.62, width * 0.78);
    }

    await drawQrCode(
      ctx,
      qrUrl,
      x + width - height * 0.2,
      y + height - height * 0.2,
      height * 0.15,
    );

    drawTrimMarks(ctx, x, y, width, height);
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

      if (panelCount === 2 && index === 1) {
        ctx.save();
        ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
        ctx.rotate(Math.PI);
        await drawCardFace(ctx, {
          x: -rect.width / 2,
          y: -rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
        ctx.restore();
      } else {
        await drawCardFace(ctx, rect);
      }
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
                {Object.entries(PAPER_SIZES).map(([id, paper]) => (
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
                <button
                  className="color-chip"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  style={{ backgroundColor: bgColor }}
                  type="button"
                >
                  {bgColor}
                </button>
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
