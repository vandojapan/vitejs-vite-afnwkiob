import { useRef, useState } from "react";
import { TwitterPicker }
  from "react-color";

function App() {
  const canvasRef = useRef(null);
  const [iconImage, setIconImage] = useState(null);
  const [name, setName] = useState("");
  const [bgColor, setBgColor] = useState("#333333");

  const renderCard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 背景を白で塗りつぶす（L判全体）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ===== セクションA: カード領域の定義 =====
    const cardWidth = 900;
    const cardHeight = 600;

    const cardX =
      (canvas.width - cardWidth) / 2;

    const cardY =
      (canvas.height - cardHeight) / 2;

    // ===== セクションB: 名札カードの背景（白いカード） =====
    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      cardX,
      cardY,
      cardWidth,
      cardHeight
    );

    // ===== セクションC: デザイン描画（曲線背景＋文字など） =====

    // 例: 上半分を暗い色で曲線に（カード内の座標系で描画）
    ctx.beginPath();

    ctx.moveTo(cardX, cardY);

    ctx.lineTo(
      cardX,
      cardY + cardHeight * 0.55
    );

    ctx.quadraticCurveTo(
      cardX + cardWidth / 2,
      cardY + cardHeight * 0.85,
      cardX + cardWidth,
      cardY + cardHeight * 0.55
    );

    ctx.lineTo(
      cardX + cardWidth,
      cardY
    );

    ctx.closePath();

    ctx.fillStyle = bgColor;
    ctx.fill();
if (iconImage) {
  const imageSize = 300;

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    cardX + cardWidth / 2,
    cardY + 220,
    imageSize / 2,
    0,
    Math.PI * 2
  );

  ctx.closePath();

  ctx.clip();

  ctx.drawImage(
    iconImage,
    cardX + cardWidth / 2 - imageSize / 2,
    cardY + 220 - imageSize / 2,
    imageSize,
    imageSize
  );

  ctx.restore();
}
    // 名前（中央寄せ）
    ctx.fillStyle = "#000000";

    ctx.font = "bold 72px sans-serif";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      name || "名無し",
      cardX + cardWidth / 2,
     iconImage
  ? cardY + cardHeight - 80
  : cardY + cardHeight / 2
    );

    // QRや画像などはここに後で描画（後ほど追加）

    // ===== セクションD: トリムマーク（トンボ）を描画 =====
    drawTrimMarks(
      ctx,
      cardX,
      cardY,
      cardWidth,
      cardHeight
    );
  };

  // トリムマーク描画用関数（renderCardの外に配置）
  function drawTrimMarks(ctx, x, y, w, h) {
    const trim = 30; // トリム線の長さ

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;

    // 左上
    ctx.beginPath();

    ctx.moveTo(x - trim, y);
    ctx.lineTo(x, y);

    ctx.moveTo(x, y - trim);
    ctx.lineTo(x, y);

    ctx.stroke();

    // 右上
    ctx.beginPath();

    ctx.moveTo(x + w + trim, y);
    ctx.lineTo(x + w, y);

    ctx.moveTo(x + w, y - trim);
    ctx.lineTo(x + w, y);

    ctx.stroke();

    // 左下
    ctx.beginPath();

    ctx.moveTo(x - trim, y + h);
    ctx.lineTo(x, y + h);

    ctx.moveTo(x, y + h + trim);
    ctx.lineTo(x, y + h);

    ctx.stroke();

    // 右下
    ctx.beginPath();

    ctx.moveTo(x + w + trim, y + h);
    ctx.lineTo(x + w, y + h);

    ctx.moveTo(x + w, y + h + trim);
    ctx.lineTo(x + w, y + h);

    ctx.stroke();
  }

  const saveCard = () => {
    const canvas = canvasRef.current;

    const link = document.createElement("a");

    link.download = "event-namecard.png";

    link.href = canvas.toDataURL("image/png");

    link.click();
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#eeeeee",
        minHeight: "100vh",
      }}
    >
      <h1>イベント名札ジェネレーター</h1>

      <input
        type="text"
        placeholder="名前を入力"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: "10px",
          fontSize: "16px",
          width: "300px",
        }}
      />

 <div
  style={{
    marginTop: "20px",
    marginBottom: "20px",
  }}
>
  <TwitterPicker
    color={bgColor}
    onChange={(color) =>
      setBgColor(color.hex)
    }
  />

  <p>
    背景色: {bgColor}
  </p>
</div>

      <button
        onClick={renderCard}
        style={{
          marginLeft: "10px",
          padding: "10px 20px",
          fontSize: "16px",
        }}
      >
        生成

      <button
        onClick={saveCard}
        style={{
          marginLeft: "10px",
          padding: "10px 20px",
          fontSize: "16px",
        }}
      >
        PNG保存
      </button>
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        setIconImage(img);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  }}
  style={{
    display: "block",
    marginTop: "20px",
  }}
/>
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={1051}
          height={1500}
          style={{
            width: "350px",
            background: "white",
            border: "1px solid #ccc",
          }}
        />
      </div>
    </div>
  );
}

export default App;