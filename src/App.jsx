import { useRef, useState } from "react";

function App() {
  const canvasRef = useRef(null);

  const [name, setName] = useState("");

  const renderCard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cardWidth = 900;
const cardHeight = 600;

const cardX =
  (canvas.width - cardWidth) / 2;

const cardY =
  (canvas.height - cardHeight) / 2;

    // 背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";

ctx.fillRect(
  cardX,
  cardY,
  cardWidth,
  cardHeight
);
    // 上側背景
    ctx.beginPath();
    
    ctx.moveTo(0, 0);
    
    ctx.lineTo(0, 900);
    
    // 曲線
    ctx.quadraticCurveTo(
      canvas.width / 2,
      1200,
      canvas.width,
      950
    );
    
    ctx.lineTo(canvas.width, 0);
    
    ctx.closePath();
    
    ctx.fillStyle = "#333333";
    ctx.fill();

    // タイトル
    ctx.fillStyle = "black";
    ctx.font = "bold 48px sans-serif";

    ctx.fillText("イベント名札", 80, 100);

    // 名前
    ctx.font = "bold 96px sans-serif";

    ctx.fillText(
      name || "名前未入力",
      cardX + 80,
      cardY + 300
    );
    ctx.strokeStyle = "#000000";
ctx.lineWidth = 2;

const trim = 30;

// 左上
ctx.beginPath();
ctx.moveTo(cardX - trim, cardY);
ctx.lineTo(cardX, cardY);

ctx.moveTo(cardX, cardY - trim);
ctx.lineTo(cardX, cardY);
ctx.stroke();

// 右上
ctx.beginPath();
ctx.moveTo(cardX + cardWidth + trim, cardY);
ctx.lineTo(cardX + cardWidth, cardY);

ctx.moveTo(cardX + cardWidth, cardY - trim);
ctx.lineTo(cardX + cardWidth, cardY);
ctx.stroke();

// 左下
ctx.beginPath();
ctx.moveTo(cardX - trim, cardY + cardHeight);
ctx.lineTo(cardX, cardY + cardHeight);

ctx.moveTo(cardX, cardY + cardHeight + trim);
ctx.lineTo(cardX, cardY + cardHeight);
ctx.stroke();

// 右下
ctx.beginPath();
ctx.moveTo(
  cardX + cardWidth + trim,
  cardY + cardHeight
);

ctx.lineTo(
  cardX + cardWidth,
  cardY + cardHeight
);

ctx.moveTo(
  cardX + cardWidth,
  cardY + cardHeight + trim
);

ctx.lineTo(
  cardX + cardWidth,
  cardY + cardHeight
);

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
      </div>
    </div>
  );
}

export default App;