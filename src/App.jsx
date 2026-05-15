import { useRef, useState } from "react";
import { TwitterPicker } from "react-color";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

function App() {
  const canvasRef = useRef(null);

  const [name, setName] = useState("");
  const [subText, setSubText] = useState("");

  const [bgColor, setBgColor]
    = useState("#333333");

  const [iconImage, setIconImage]
    = useState(null);

  const [
    showColorPicker,
    setShowColorPicker,
  ] = useState(false);

  const [imageSrc, setImageSrc]
  = useState(null);

const [crop, setCrop]
  = useState({
    unit: "%",
    width: 80,
    aspect: 1,
  });

  const renderCard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // ===== L判背景 =====

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    // ===== カードサイズ =====

    const cardWidth = 900;
    const cardHeight = 600;

    const cardX =
      (canvas.width - cardWidth) / 2;

    const cardY =
      (canvas.height - cardHeight) / 2;

    // ===== カード背景 =====

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
      cardX,
      cardY,
      cardWidth,
      cardHeight
    );

    // ===== 上側背景 =====

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

    // ===== アイコン描画 =====

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
        cardX + cardWidth / 2
          - imageSize / 2,
        cardY + 220
          - imageSize / 2,
        imageSize,
        imageSize
      );

      ctx.restore();
    }

    // ===== テキスト描画 =====

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (iconImage) {
      // アイコンあり版

      ctx.fillStyle = "#000000";

      ctx.font =
        "bold 72px sans-serif";

      ctx.fillText(
        name || "名前未入力",
        cardX + cardWidth / 2,
        cardY + cardHeight - 80
      );
    } else {
      // テキストのみ版

      ctx.fillStyle = "#000000";

      ctx.font =
        "bold 96px sans-serif";

      ctx.fillText(
        name || "名前未入力",
        cardX + cardWidth / 2,
        cardY + cardHeight / 2 - 40
      );

      ctx.font = "48px sans-serif";

      ctx.fillStyle = "#666666";

      ctx.fillText(
        subText || "",
        cardX + cardWidth / 2,
        cardY + cardHeight / 2 + 80
      );
    }

    // ===== トリムマーク =====

    drawTrimMarks(
      ctx,
      cardX,
      cardY,
      cardWidth,
      cardHeight
    );
  };

  // ===== トリムマーク関数 =====

  function drawTrimMarks(
    ctx,
    x,
    y,
    w,
    h
  ) {
    const trim = 30;

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

    ctx.moveTo(
      x + w + trim,
      y + h
    );

    ctx.lineTo(
      x + w,
      y + h
    );

    ctx.moveTo(
      x + w,
      y + h + trim
    );

    ctx.lineTo(
      x + w,
      y + h
    );

    ctx.stroke();
  }

  // ===== PNG保存 =====

  const saveCard = () => {
    const canvas = canvasRef.current;

    const link =
      document.createElement("a");

    link.download =
      "event-namecard.png";

    link.href =
      canvas.toDataURL("image/png");

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
      <h1>
        イベント名札ジェネレーター
      </h1>

      {/* 名前入力 */}

      <input
        type="text"
        placeholder="名前を入力"
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
        style={{
          padding: "10px",
          fontSize: "16px",
          width: "300px",
        }}
      />

      {/* サブテキスト */}

      {
        !iconImage && (
          <input
            type="text"
            placeholder="サブテキスト"
            value={subText}
            onChange={(e) =>
              setSubText(
                e.target.value
              )
            }
            style={{
              display: "block",
              marginTop: "10px",
              padding: "10px",
              fontSize: "16px",
              width: "300px",
            }}
          />
        )
      }

      {/* ボタン群 */}

      <div
        style={{
          marginTop: "20px",
        }}
      >
        <button
          onClick={renderCard}
          style={{
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

        <button
          onClick={() =>
            setShowColorPicker(
              !showColorPicker
            )
          }
          style={{
            marginLeft: "10px",
            padding: "10px 20px",
            fontSize: "16px",
          }}
        >
          色設定
        </button>
      </div>

      {/* カラーピッカー */}

      {
        showColorPicker && (
          <div
            style={{
              marginTop: "20px",
            }}
          >
            <TwitterPicker
              color={bgColor}
              onChange={(color) =>
                setBgColor(
                  color.hex
                )
              }
            />

            <p>
              背景色: {bgColor}
            </p>
          </div>
        )
      }

      {/* 画像アップロード */}

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file =
            e.target.files[0];

          if (!file) return;

          const reader =
            new FileReader();

          reader.onload = () => {
            const img =
              new Image();

            img.onload = () => {
              setImageSrc(reader.result);;
            };

            img.src =
              reader.result;
          };

          reader.readAsDataURL(
            file
          );
        }}
        style={{
          display: "block",
          marginTop: "20px",
        }}
      />
{
  imageSrc && (
    <div
      style={{
        marginTop: "20px",
        maxWidth: "400px",
      }}
    >
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}
        aspect={1}
      >
        <img
          src={imageSrc}
          alt="Crop"
          style={{
            maxWidth: "100%",
          }}
        />
      </ReactCrop>
    </div>
  )
}
      {/* Canvas */}

      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent:
            "center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={1051}
          height={1500}
          style={{
            width: "350px",
            background: "white",
            border:
              "1px solid #ccc",
          }}
        />
      </div>
    </div>
  );
}

export default App;