import { useRef, useState } from "react";

function App() {
  const canvasRef = useRef(null);

  const [name, setName] = useState("");

  const renderCard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 背景
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = "black";
    ctx.font = "bold 48px sans-serif";

    ctx.fillText("イベント名札", 80, 100);

    // 名前
    ctx.font = "bold 96px sans-serif";

    ctx.fillText(name || "名前未入力", 80, 300);
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

      <div style={{ marginTop: "20px" }}>
        <canvas
          ref={canvasRef}
          width="1051"