/**
 * BalloonDisplay.tsx — OBS Display page for Balloon game
 * Tham khảo hiệu ứng từ balloon.html (wobble, water-drop, water-stream, click -1)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";
const NS = "game:balloon";

interface BalloonConfig {
  burstThreshold: number;
  likeMinCount: number;
}
interface FeedItem {
  id: string;
  type: "like" | "gift" | "chat";
  username: string;
  avatar?: string;
  text: string;
  pumps: number;
  ts: number;
}
const DEFAULT_CFG: BalloonConfig = { burstThreshold: 100, likeMinCount: 20 };

export default function BalloonDisplay() {
  const [config, setConfig] = useState<BalloonConfig>(DEFAULT_CFG);
  const [pumps, setPumps] = useState(0);
  const [burst, setBurst] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<
    "waiting" | "connected" | "disconnected"
  >("waiting");
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [totalChats, setTotalChats] = useState(0);

  const urlParams = new URLSearchParams(window.location.search);
  const targetUser = urlParams.get("u") || "";
  const roomId = `balloon:${targetUser}`;

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const configRef = useRef(config);
  const pumpsRef = useRef(0);
  const burstRef = useRef(false);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedLikesRef = useRef(0);

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    pumpsRef.current = pumps;
  }, [pumps]);
  useEffect(() => {
    burstRef.current = burst;
  }, [burst]);

  // ── Hiệu ứng giọt nước rơi ─────────────────────────────────────────────────
  const createWaterDrop = useCallback((amount = 1) => {
    if (!gameAreaRef.current || burstRef.current) return;
    for (let i = 0; i < Math.min(amount, 5); i++) {
      setTimeout(() => {
        const drop = document.createElement("div");
        drop.style.cssText = `
          position:absolute; width:14px; height:18px; pointer-events:none; z-index:10;
          background:radial-gradient(circle at 30% 30%,#fff,#38bdf8);
          border-radius:50% 50% 50% 50%/60% 60% 40% 40%;
          box-shadow:0 4px 8px rgba(0,0,0,0.2);
          left:calc(50% + ${Math.random() * 30 - 15}px);
          top:30px;
          animation:fall 0.9s ease-in forwards;
        `;
        gameAreaRef.current?.appendChild(drop);
        setTimeout(() => drop.remove(), 950);
      }, i * 120);
    }
  }, []);

  // ── Hiệu ứng tia nước từ vòi ───────────────────────────────────────────────
  const showWaterStream = useCallback(() => {
    if (!streamRef.current || burstRef.current) return;
    streamRef.current.style.height = "45%";
    if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    streamTimerRef.current = setTimeout(() => {
      if (streamRef.current) streamRef.current.style.height = "0px";
    }, 350);
  }, []);

  // ── Hiệu ứng text fly-up ───────────────────────────────────────────────────
  const spawnFloatingText = useCallback((text: string, color = "#fff") => {
    if (!gameAreaRef.current) return;
    const el = document.createElement("div");
    el.style.cssText = `
      position:absolute; font-weight:900; font-size:22px; pointer-events:none;
      color:${color}; text-shadow:0 0 6px rgba(0,0,0,0.6);
      left:calc(50% + ${Math.random() * 60 - 30}px);
      top:calc(50% + ${Math.random() * 40 - 20}px);
      animation:flyUp 1s ease-out forwards; z-index:30;
    `;
    el.textContent = text;
    gameAreaRef.current.appendChild(el);
    setTimeout(() => el.remove(), 1050);
  }, []);

  // ── Thêm điểm bơm ─────────────────────────────────────────────────────────
  const addPumps = useCallback((amount: number) => {
    if (burstRef.current) return;
    setPumps((prev) => {
      const next = prev + amount;
      const threshold = configRef.current.burstThreshold;
      if (next >= threshold && !burstRef.current) {
        burstRef.current = true;
        setBurst(true);
      }
      return next;
    });
  }, []);

  // ── Click xẹp bóng -1 ─────────────────────────────────────────────────────
  const handleBalloonClick = useCallback(() => {
    if (burstRef.current || pumpsRef.current <= 0 || !targetUser) return;
    socketRef.current?.emit("balloon-deflate", { roomId });
    setPumps((p) => Math.max(0, p - 1));
    spawnFloatingText("-1 💦", "#38bdf8");
  }, [spawnFloatingText, targetUser, roomId]);

  // ── Feed helper ────────────────────────────────────────────────────────────
  const addFeed = useCallback((item: Omit<FeedItem, "id" | "ts">) => {
    setFeed((prev) => [
      { ...item, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ...prev.slice(0, 29),
    ]);
  }, []);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUser) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("join-room", roomId);
    });
    socket.on("disconnect", () => setStatus("disconnected"));

    socket.on("setup-balloon", (cfg: BalloonConfig) => {
      setConfig(cfg);
      setPumps(0);
      setBurst(false);
      burstRef.current = false;
      pumpsRef.current = 0;
      accumulatedLikesRef.current = 0;
      setTotalLikes(0);
      setTotalGifts(0);
      setTotalChats(0);
      setFeed([]);
    });

    socket.on("balloon-reset", () => {
      setPumps(0);
      setBurst(false);
      burstRef.current = false;
      pumpsRef.current = 0;
      accumulatedLikesRef.current = 0;
      setFeed([]);
    });

    socket.on("balloon-deflate", () => {
      if (!burstRef.current) {
        setPumps((p) => Math.max(0, p - 1));
        spawnFloatingText("-1 💦", "#38bdf8");
      }
    });

    socket.on(`${NS}:chat`, (data: any) => {
      setTotalChats((n) => n + 1);
      addPumps(1);
      showWaterStream();
      createWaterDrop(1);
      addFeed({
        type: "chat",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: data.comment || "...",
        pumps: 1,
      });
      spawnFloatingText("+1 💦", "#7dd3fc");
    });

    socket.on(`${NS}:like`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setTotalLikes((n) => n + count);

      accumulatedLikesRef.current += count;
      const minCount = configRef.current.likeMinCount || 20;
      let gained = 0;

      if (accumulatedLikesRef.current >= minCount) {
        gained = Math.floor(accumulatedLikesRef.current / minCount);
        accumulatedLikesRef.current = accumulatedLikesRef.current % minCount;
      }

      if (gained > 0) {
        addPumps(gained);
        createWaterDrop(Math.min(gained, 5));
        spawnFloatingText(`+${gained} 💦`, "#f9a8d4");
      }
      addFeed({
        type: "like",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: `${count} ❤️`,
        pumps: gained,
      });
    });

    socket.on(`${NS}:gift`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      const diamonds = (data.diamonds || 1) * count;
      setTotalGifts((n) => n + count);
      addPumps(diamonds);
      createWaterDrop(Math.min(diamonds, 8));
      showWaterStream();
      spawnFloatingText(`+${diamonds} 💦`, "#e879f9");
      addFeed({
        type: "gift",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: `${data.giftName || "quà"} x${count}`,
        pumps: diamonds,
      });
    });

    socket.on(`${NS}:disconnected`, () => setStatus("disconnected"));
    return () => {
      socket.disconnect();
    };
  }, [
    addPumps,
    addFeed,
    createWaterDrop,
    showWaterStream,
    spawnFloatingText,
    targetUser,
    roomId,
  ]);

  if (!targetUser) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050816",
          color: "#fff",
        }}
      >
        <p>⚠️ Thiếu TikTok ID. Hãy copy link từ bảng điều khiển.</p>
      </div>
    );
  }

  const pct = Math.min(
    (pumps / Math.max(configRef.current.burstThreshold, 1)) * 100,
    100,
  );
  const nearBurst = pct >= 80;
  const almostBurst = pct >= 95;

  // Balloon size: 140px → 300px
  const balloonPx = Math.round(200 + (pct / 100) * 220);
  const balloonColor = almostBurst
    ? "radial-gradient(circle at 30% 30%,rgba(255,200,200,0.9),rgba(239,68,68,0.9) 40%,rgba(153,27,27,1))"
    : nearBurst
      ? "radial-gradient(circle at 30% 30%,rgba(255,220,180,0.9),rgba(249,115,22,0.9) 40%,rgba(154,52,18,1))"
      : "radial-gradient(circle at 30% 30%,rgba(255,255,255,0.85),rgba(56,189,248,0.9) 20%,rgba(2,132,199,0.9) 60%,rgba(3,105,161,1))";
  const glowColor = almostBurst
    ? "rgba(239,68,68,0.6)"
    : nearBurst
      ? "rgba(249,115,22,0.5)"
      : "rgba(56,189,248,0.4)";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        color: "#fff",
        background:
          "radial-gradient(circle at top,rgba(14,165,233,0.18),transparent 30%),linear-gradient(180deg,#050816 0%,#090d22 100%)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      {/* Status */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              status === "connected"
                ? "#4ade80"
                : status === "disconnected"
                  ? "#f87171"
                  : "#fbbf24",
            display: "inline-block",
            animation:
              status !== "disconnected" ? "pulse 1.5s infinite" : undefined,
          }}
        />
        <span
          style={{
            color:
              status === "connected"
                ? "#86efac"
                : status === "disconnected"
                  ? "#fca5a5"
                  : "#fde68a",
          }}
        >
          {status === "connected"
            ? "Đang live"
            : status === "disconnected"
              ? "Mất kết nối"
              : "Chờ kết nối..."}
        </span>
      </div>

      {/* Left panel */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          marginTop: 40,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: 200,
        }}
      >
        {/* Stats */}
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            📊 Thống kê
          </p>
          {[
            { icon: "❤️", label: "Like", value: totalLikes, color: "#f87171" },
            { icon: "🎁", label: "Quà", value: totalGifts, color: "#e879f9" },
            { icon: "💬", label: "Chat", value: totalChats, color: "#38bdf8" },
            { icon: "💦", label: "Bơm", value: pumps, color: "#7dd3fc" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {s.icon} {s.label}
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: s.color }}>
                {s.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        {/* Rules */}
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            📋 Cách bơm
          </p>
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.9 }}>
            <div>
              💬 Chat →{" "}
              <span style={{ color: "#7dd3fc", fontWeight: 700 }}>+1</span>
            </div>
            <div>
              ❤️ Like ≥ {config.likeMinCount} →{" "}
              <span style={{ color: "#f9a8d4", fontWeight: 700 }}>+1</span>
            </div>
            <div>
              🎁 Quà →{" "}
              <span style={{ color: "#e879f9", fontWeight: 700 }}>+💎×qty</span>
            </div>
            <div style={{ color: "#38bdf8", fontWeight: 700, marginTop: 4 }}>
              🖱️ Click bóng → -1
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              fontSize: 10,
              color: "#475569",
            }}
          >
            Ngưỡng nổ:{" "}
            <span style={{ color: "#7dd3fc" }}>{config.burstThreshold}</span>
          </div>
        </div>
      </div>

      {/* Game area */}
      <div
        ref={gameAreaRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 16, zIndex: 20 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              background: "linear-gradient(90deg,#38bdf8,#818cf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: 2,
              marginBottom: 4,
            }}
          >
            Bong Bóng Nước 💦
          </h1>
          <p style={{ fontSize: 14, color: "rgba(148,163,184,0.8)" }}>
            Comment / Like / Quà để bơm • Click bóng để xẹp
          </p>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: Math.max(balloonPx, 260),
            marginBottom: 20,
            zIndex: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 4,
              color: almostBurst
                ? "#f87171"
                : nearBurst
                  ? "#fb923c"
                  : "#7dd3fc",
            }}
          >
            <span>Áp suất</span>
            <span
              style={{
                animation: almostBurst ? "pulse 0.5s infinite" : undefined,
              }}
            >
              {pumps} / {config.burstThreshold} ({pct.toFixed(1)}%)
            </span>
          </div>
          <div
            style={{
              height: 14,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 99,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                transition: "width 0.4s ease",
                width: `${pct}%`,
                background: almostBurst
                  ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : nearBurst
                    ? "linear-gradient(90deg,#f97316,#ef4444)"
                    : "linear-gradient(90deg,#0ea5e9,#6366f1)",
              }}
            />
          </div>
        </div>

        {/* Water pipe + stream */}
        <div
          style={{
            position: "absolute",
            top: 0,
            width: 60,
            height: 32,
            background: "#3f3f46",
            border: "3px solid #18181b",
            borderRadius: "0 0 8px 8px",
            display: "flex",
            justifyContent: "center",
            zIndex: 25,
          }}
        >
          <div
            style={{
              width: 36,
              height: 8,
              background: "#18181b",
              borderRadius: "0 0 4px 4px",
              position: "absolute",
              bottom: 0,
            }}
          />
        </div>
        <div
          ref={streamRef}
          style={{
            position: "absolute",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            width: 36,
            height: 0,
            borderRadius: 20,
            zIndex: 15,
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom,rgba(56,189,248,0.7),rgba(56,189,248,0))",
            transition: "height 0.12s ease-out",
          }}
        />

        {/* The Balloon */}
        {!burst ? (
          <div
            onClick={handleBalloonClick}
            style={{
              position: "relative",
              zIndex: 20,
              cursor: "pointer",
              width: balloonPx,
              height: balloonPx,
              background: balloonColor,
              boxShadow: `inset -12px -12px 24px rgba(0,0,0,0.3),inset 10px 10px 22px rgba(255,255,255,0.5),0 20px 50px ${glowColor}`,
              transition:
                "width 0.35s cubic-bezier(0.175,0.885,0.32,1.275),height 0.35s cubic-bezier(0.175,0.885,0.32,1.275)",
              animation: "wobble 7s ease-in-out infinite",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            {/* Highlight */}
            <div
              style={{
                position: "absolute",
                top: "15%",
                left: "20%",
                width: "28%",
                height: "14%",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.45)",
                transform: "rotate(-40deg)",
                filter: "blur(3px)",
              }}
            />
            {/* % text */}
            <span
              style={{
                fontSize: Math.max(20, balloonPx * 0.18),
                fontWeight: 900,
                color: "rgba(255,255,255,0.9)",
                textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                pointerEvents: "none",
                animation: almostBurst ? "pulse 0.4s infinite" : undefined,
              }}
            >
              {pct.toFixed(0)}%
            </span>
            {/* Click hint */}
            <div
              style={{
                position: "absolute",
                bottom: "14%",
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.6)",
                pointerEvents: "none",
              }}
            >
              CLICK!
            </div>
          </div>
        ) : (
          /* BOOM */
          <div
            style={{
              textAlign: "center",
              animation: "pop 350ms cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <div
              style={{
                fontSize: 120,
                lineHeight: 1,
                filter: "drop-shadow(0 0 40px rgba(255,100,0,0.9))",
              }}
            >
              💥
            </div>
            <p
              style={{
                fontSize: 72,
                fontWeight: 900,
                background: "linear-gradient(90deg,#f97316,#ef4444,#ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginTop: 8,
              }}
            >
              BOOM!
            </p>
            <p
              style={{
                fontSize: 22,
                color: "#cbd5e1",
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              Bóng đã nổ! 🎈💦
            </p>
            <p style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>
              {pumps} điểm | Ngưỡng: {config.burstThreshold}
            </p>
            <button
              onClick={() => {
                socketRef.current?.emit("balloon-reset");
                setPumps(0);
                setBurst(false);
                burstRef.current = false;
                pumpsRef.current = 0;
                setFeed([]);
              }}
              style={{
                marginTop: 24,
                padding: "14px 40px",
                fontSize: 18,
                fontWeight: 900,
                color: "#fff",
                background: "linear-gradient(90deg,#22c55e,#16a34a)",
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(34,197,94,0.35)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.04)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              🔄 Chơi Lại
            </button>
          </div>
        )}
      </div>

      {/* Right: Live feed */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          bottom: 10,
          zIndex: 40,
          width: 220,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <p
          style={{
            fontSize: 10,
            color: "#64748b",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          📡 Sự kiện Live
          {status === "connected" && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                background: "rgba(239,68,68,0.2)",
                color: "#fca5a5",
                padding: "2px 6px",
                borderRadius: 99,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#ef4444",
                  display: "inline-block",
                  animation: "pulse 1s infinite",
                }}
              />
              LIVE
            </span>
          )}
        </p>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {feed.length === 0 ? (
            <p
              style={{
                fontSize: 11,
                color: "#334155",
                textAlign: "center",
                paddingTop: 24,
              }}
            >
              Đang chờ...
            </p>
          ) : (
            feed.map((item) => {
              const cfg = {
                like: { border: "#f87171", bg: "rgba(239,68,68,0.06)" },
                gift: { border: "#e879f9", bg: "rgba(232,121,249,0.06)" },
                chat: { border: "#38bdf8", bg: "rgba(56,189,248,0.06)" },
              }[item.type];
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 7,
                    padding: "7px 8px",
                    borderRadius: 10,
                    borderLeft: `3px solid ${cfg.border}`,
                    background: cfg.bg,
                    alignItems: "flex-start",
                  }}
                >
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt=""
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {item.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          maxWidth: 80,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        @{item.username}
                      </span>
                      {item.pumps > 0 && (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            background: "rgba(56,189,248,0.2)",
                            color: "#7dd3fc",
                            padding: "1px 5px",
                            borderRadius: 99,
                          }}
                        >
                          +{item.pumps}💦
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 9,
                        color: "#64748b",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes wobble {
          0%,100% { border-radius:40% 60% 70% 30%/40% 50% 60% 50%; }
          33%      { border-radius:70% 30% 50% 50%/30% 30% 70% 70%; }
          66%      { border-radius:100% 60% 60% 100%/100% 100% 60% 60%; }
        }

        @keyframes fall {
          0%   { transform:translateY(0) scale(0); opacity:0; }
          15%  { transform:translateY(0) scale(1); opacity:1; }
          80%  { transform:translateY(55vh) scale(1); opacity:1; }
          100% { transform:translateY(65vh) scale(0); opacity:0; }
        }
        @keyframes flyUp {
          0%   { transform:translateY(0) scale(1); opacity:1; }
          100% { transform:translateY(-55px) scale(1.5); opacity:0; }
        }
        @keyframes pop {
          0%   { transform:scale(0.3); opacity:0; }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.4; }
        }
      `}</style>
    </div>
  );
}
