// src/BarcodeCapturePage.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";

const SOCKET_IO_URL = "https://hints-prize-assumes-choice.trycloudflare.com"; // 실제 서버 주소로 수정

const BarcodeCapturePage = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [detections, setDetections] = useState([]);
  const [captured, setCaptured] = useState(false);
  const [decodeResult, setDecodeResult] = useState(null);
  const lastYoloSentRef = useRef(Date.now());

  const captureAndSendFrame = useCallback(() => {
    if (!canvasRef.current || !socket) return;
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL("image/jpeg", 0.8);
    socket.emit("decode-request", dataURL);
  }, [socket]);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error("카메라 접근 실패:", err);
        alert("카메라를 사용할 수 없습니다. 브라우저 설정을 확인하세요.");
      }
    };
    setupCamera();
  }, []);

  useEffect(() => {
    const s = io(SOCKET_IO_URL, {
      transports: ["websocket"],
    });
    setSocket(s);

    s.on("connect", () => console.log("Socket connected!"));
    s.on("disconnect", () => console.log("Socket disconnected!"));

    s.on("barcode-detection", (data) => {
      if (Array.isArray(data)) {
        setDetections(data);
      } else {
        console.error("barcode-detection 결과 에러:", data);
      }
    });

    s.on("decode-result", (data) => {
      console.log("📦 서버 디코딩 결과 수신:", data);
      setDecodeResult(data);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    let animationId;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let foundBlue = false;

      const marginX = canvas.width / 6;
      const marginY = canvas.height / 6;
      const centerX1 = marginX;
      const centerY1 = marginY;
      const centerX2 = canvas.width - marginX;
      const centerY2 = canvas.height - marginY;

      ctx.strokeStyle = "rgba(0, 255, 0, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(centerX1, centerY1, centerX2 - centerX1, centerY2 - centerY1);
      ctx.setLineDash([]);

      detections.forEach((det) => {
        const { x1, y1, x2, y2, confidence } = det;

        const boxCenterX = (x1 + x2) / 2;
        const boxCenterY = (y1 + y2) / 2;
        const isInCenter =
          boxCenterX >= centerX1 &&
          boxCenterX <= centerX2 &&
          boxCenterY >= centerY1 &&
          boxCenterY <= centerY2;

        if (!isInCenter) return;

        let boxColor = "red";
        if (confidence >= 0.7) {
          boxColor = "blue";
          if (!captured) foundBlue = true;
        } else if (confidence >= 0.3) {
          boxColor = "yellow";
        }

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        const confText = `Conf: ${(confidence * 100).toFixed(1)}%`;
        ctx.font = "16px Arial";
        ctx.fillStyle = boxColor;
        ctx.fillText(confText, x1, y1 > 20 ? y1 - 5 : y1 + 15);
      });

      const now = Date.now();
      if (now - lastYoloSentRef.current > 300) {
        const canvas = canvasRef.current;
        const dataURL = canvas.toDataURL("image/jpeg", 0.7);
        socket?.emit("frame", dataURL);
        lastYoloSentRef.current = now;
      }

      if (foundBlue && !captured) {
        console.log("🟦 중앙 파란 박스 발견 → 디코딩용 프레임 전송");
        captureAndSendFrame();
        setCaptured(true);
        setTimeout(() => setCaptured(false), 3000); // 재전송 가능 시간 설정
      }

      animationId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [detections, captured, captureAndSendFrame]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>📷 실시간 바코드 검출 데모</h2>

      {captured && (
        <div style={{ color: "blue", margin: "10px 0" }}>
          ✅ 파란 박스 감지됨 → 서버로 전송됨!
        </div>
      )}

      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          style={{ width: "600px", transform: "scaleX(-1)" }}
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "600px",
            pointerEvents: "none",
          }}
        />
      </div>

      {decodeResult && (
        <div style={{ marginTop: "20px", color: "green" }}>
          <h3>📦 디코딩 결과</h3>
          <pre>{JSON.stringify(decodeResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default BarcodeCapturePage;