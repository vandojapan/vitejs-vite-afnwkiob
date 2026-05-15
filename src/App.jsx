import { useRef, useState } from "react";

function App() {
  const canvasRef = useRef(null);

  const [name, setName] = useState("");
  const [bgColor, setBgColor] = useState("#ffffff");

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

    // 名前（中央寄せ）
    ctx.fillStyle = "#000000";

    ctx.font = "bold 72px sans-serif";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      name || "名前未入力",
      cardX + cardWidth / 2,
      cardY + cardHeight - 120
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

      <input
        type="color"
        value={bgColor}
        onChange={(e) =>
          setBgColor(e.target.value)
        }
        style={{
          marginLeft: "10px",
          width: "50px",
          height: "40px",
          verticalAlign: "middle",
        }}
      />

      <button
        onClick={renderCard}
        style={{
          marginLeft: "10px",
          padding: "10px 20px",
          fontSize: "16px",
        }}
      >
        生成
      </button>

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