import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

import { TwitterPicker } from "react-color";
import ReactCrop from "react-image-crop";

import "react-image-crop/dist/ReactCrop.css";

function AppNew() {
  const canvasRef = useRef(null);

  const [activeTab, setActiveTab] = useState("simple");
  const [name, setName] = useState("");
  const [subText, setSubText] = useState("");
  const [bgColor, setBgColor] = useState("#333333");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [iconImage, setIconImage] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ unit: "%", width: 80, aspect: 1 });
  const [accountUrl, setAccountUrl] = useState("");
  const [url, setUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [simpleLoading, setSimpleLoading] = useState(false);

  const parseUsernameFromUrl = (value) => {
    const input = value.trim();
    if (!input) return "";
    let maybeUrl = input;
    if (!/^https?:\/\//i.test(maybeUrl)) {
      maybeUrl = `https://${maybeUrl}`;
    }
    try {
      const parsed = new URL(maybeUrl);
      const host = parsed.host.replace(/^www\./i, "");
      const path = parsed.pathname.replace(/\/+$|^\/+/, "");
      const segments = path.split("/").filter(Boolean);
      if (!segments.length) return "";
      if (host.includes("x.com") || host.includes("twitter.com")) {
        return segments[0];
      }
      if (host.includes("youtube.com")) {
        const first = segments[0];
        if (first.startsWith("@")) return first.replace(/^@/, "");
        if (["c", "channel", "user"].includes(first) && segments[1]) return segments[1];
        return first;
      }
      if (host.includes("youtu.be")) {
        return segments[0];
      }
      return segments[segments.length - 1];
    } catch {
      return "";
    }
  };

  const TWITTER_API_TOKEN = import.meta.env.VITE_X_API_TOKEN || "";

  const getContrastTextColor = (hex) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 186 ? "#000000" : "#ffffff";
  };

  const loadRemoteImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const fetchTwitterProfileImage = async (username) => {
    if (!TWITTER_API_TOKEN) {
      throw new Error("X API トークンが設定されていません");
    }

    try {
      const response = await fetch(
        `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}?user.fields=profile_image_url`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${TWITTER_API_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`X API エラー: ${response.status}`);
      }

      const data = await response.json();
      if (!data.data?.profile_image_url) {
        throw new Error("プロフィール画像 URL が見つかりません");
      }

      return data.data.profile_image_url.replace("_normal", "_400x400");
    } catch (error) {
      throw error;
    }
  };

  const loadXProfileImage = async () => {
    const identifier = accountUrl.trim();
    if (!identifier) {
      setAvatarError("アカウント URL を入力してから実行してください。");
      return;
    }

    const parsedName = parseUsernameFromUrl(accountUrl);
    if (!parsedName) {
      setAvatarError("有効な X アカウント URL ではありません。");
      return;
    }

    if (!accountUrl.includes("x.com") && !accountUrl.includes("twitter.com")) {
      setAvatarError("X (Twitter) のアカウント URL を入力してください。");
      return;
    }

    setName(parsedName);
    setAvatarError("");
    setSimpleLoading(true);

    try {
      const imageUrl = await fetchTwitterProfileImage(parsedName);
      const img = await loadRemoteImage(imageUrl);
      setIconImage(img);
    } catch (error) {
      if (error.message.includes("トークンが設定されていません")) {
        setAvatarError("X API 認証設定が必要です。");
      } else if (error.message.includes("404") || error.message.includes("not found")) {
        setAvatarError("このアカウントは見つかりません。");
      } else {
        setAvatarError(`エラー: ${error.message}`);
      }
    } finally {
      setSimpleLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setQrCodeDataUrl(null);
      return;
    }

    QRCode.toDataURL(trimmedUrl, { width: 300, margin: 0 })
      .then((dataUrl) => {
        if (isMounted) {
          setQrCodeDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (isMounted) {
          setQrCodeDataUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  const renderCard = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const cardWidth = 900;
    const cardHeight = 600;
    const cardX = (canvas.width - cardWidth) / 2;
    const cardY = (canvas.height - cardHeight) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    ctx.beginPath();
    ctx.moveTo(cardX, cardY);
    ctx.lineTo(cardX, cardY + cardHeight * 0.55);
    ctx.quadraticCurveTo(
      cardX + cardWidth / 2,
      cardY + cardHeight * 0.85,
      cardX + cardWidth,
      cardY + cardHeight * 0.55
    );
    ctx.lineTo(cardX + cardWidth, cardY);
    ctx.closePath();
    ctx.fillStyle = bgColor;
    ctx.fill();

    if (iconImage) {
      const imageSize = 300;
      const size = Math.min(iconImage.width, iconImage.height);
      const sx = (iconImage.width - size) / 2;
      const sy = (iconImage.height - size) / 2;
      ctx.drawImage(
        iconImage,
        sx,
        sy,
        size,
        size,
        cardX + cardWidth / 2 - imageSize / 2,
        cardY + 220 - imageSize / 2,
        imageSize,
        imageSize
      );
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const contrastTextColor = getContrastTextColor(bgColor);

    if (iconImage) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 72px sans-serif";
      ctx.fillText(name || "名前未入力", cardX + cardWidth / 2, cardY + cardHeight - 80);
    } else {
      ctx.fillStyle = contrastTextColor;
      ctx.font = "bold 96px sans-serif";
      ctx.fillText(name || "名前未入力", cardX + cardWidth / 2, cardY + cardHeight / 2 - 40);
      ctx.font = "48px sans-serif";
      ctx.fillStyle = contrastTextColor;
      ctx.fillText(subText || "", cardX + cardWidth / 2, cardY + cardHeight / 2 + 80);
    }

    const qrSize = cardHeight * 0.22;
    const qrPadding = 24;
    if (qrCodeDataUrl) {
      try {
        const qrImage = await loadRemoteImage(qrCodeDataUrl);
        const qrX = cardX + cardWidth - qrSize - qrPadding;
        const qrY = cardY + cardHeight - qrSize - qrPadding;
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      } catch (error) {
        // QR 生成に失敗しても続行します
      }
    }

    drawTrimMarks(ctx, cardX, cardY, cardWidth, cardHeight);
  };

  const drawTrimMarks = (ctx, x, y, w, h) => {
    const trim = 30;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - trim, y);
    ctx.lineTo(x, y);
    ctx.moveTo(x, y - trim);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w + trim, y);
    ctx.lineTo(x + w, y);
    ctx.moveTo(x + w, y - trim);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - trim, y + h);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x, y + h + trim);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w + trim, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y + h + trim);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
  };

  const saveCard = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "event-namecard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="app-shell">
      <h1>イベント名札ジェネレーター</h1>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab-button ${activeTab === "simple" ? "active" : ""}`}
          onClick={() => setActiveTab("simple")}
        >
          シンプル
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "advance" ? "active" : ""}`}
          onClick={() => setActiveTab("advance")}
        >
          アドバンス
        </button>
      </div>

      <div className="tab-panel">
        <div className="field-group">
          <label>
            名前
            <input
              type="text"
              placeholder="unavatar取得で反映"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <div className="field-group">
          <label>
            アカウントURL
            <input
              type="text"
              placeholder="X / YouTube アカウント URL"
              value={accountUrl}
              onChange={(e) => setAccountUrl(e.target.value)}
            />
          </label>
        </div>

        {activeTab === "simple" ? (
          <>
            <div className="field-group">
              <button
                className="app-button"
                type="button"
                onClick={loadXProfileImage}
                disabled={simpleLoading || !accountUrl.trim()}
              >
                {simpleLoading ? "取得中…" : "X でアイコン取得"}
              </button>
            </div>
            <p className="help-text">X (Twitter) アカウント URL を入力してプロフィール画像を取得します。</p>
            {avatarError && <p className="error-text">{avatarError}</p>}
            {iconImage && (
              <div className="preview-block">
                <img src={iconImage.src} alt="アイコンプレビュー" className="avatar-preview" />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="field-group">
              {!iconImage && (
                <label>
                  サブテキスト
                  <input
                    type="text"
                    placeholder="サブテキスト"
                    value={subText}
                    onChange={(e) => setSubText(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="field-group">
              <button
                className="app-button"
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                {showColorPicker ? "色設定を閉じる" : "色設定"}
              </button>
            </div>
            {showColorPicker && (
              <div className="color-picker-panel">
                <TwitterPicker color={bgColor} onChange={(color) => setBgColor(color.hex)} />
                <p>背景色: {bgColor}</p>
              </div>
            )}
            <div className="field-group">
              <label className="file-label">
                画像をアップロード
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setImageSrc(reader.result);
                      setShowCropModal(true);
                      const img = new Image();
                      img.onload = () => setIconImage(img);
                      img.src = reader.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          </>
        )}
      </div>

      <div className="field-group url-group">
        <label>
          URL
          <input
            type="text"
            placeholder="URLを入力"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="app-button" type="button" onClick={renderCard}>
          生成
        </button>
        <button className="app-button" type="button" onClick={saveCard}>
          PNG保存
        </button>
      </div>

      {showCropModal && imageSrc && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>アイコンを調整</h2>
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} aspect={1}>
              <img src={imageSrc} alt="Crop" style={{ maxWidth: "100%" }} />
            </ReactCrop>
            <button className="app-button" type="button" onClick={() => setShowCropModal(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="canvas-wrapper">
        <canvas ref={canvasRef} width={1051} height={1500} />
      </div>
    </div>
  );
}

export default AppNew;
