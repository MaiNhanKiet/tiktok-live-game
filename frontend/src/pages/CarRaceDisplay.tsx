/**
 * CarRaceDisplay.tsx
 * Trang hiển thị game đua xe công khai (không cần đăng nhập).
 * Dùng để thêm vào OBS Browser Source.
 * Route: /game/car-race/display
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";
const GAME_KEY = "car_race";
const NS = `game:${GAME_KEY}`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface LaneConfig {
  id: string;
  name: string;
  emoji: string;
  flag: string;
  gift: string;
  color: string;
}

interface RaceConfig {
  stepLimit: number;
  lanes: LaneConfig[];
}

interface TopGifter {
  username: string;
  avatar?: string;
  total: number;
  giftName?: string;
}

interface FeedItem {
  id: string;
  type: "like" | "gift" | "chat";
  username: string;
  avatar?: string;
  text: string;
  giftImg?: string;
  amount?: number;
  ts: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CarRaceDisplay() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Config
  const [config, setConfig] = useState<RaceConfig | null>(null);

  // Race Progress
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [winner, setWinner] = useState<LaneConfig | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const targetUser = urlParams.get("u") || "";
  const roomId = `car_race:${targetUser}`;

  // Stats
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [totalDiamonds, setTotalDiamonds] = useState(0);

  // Top gifters map: username → { total, avatar, giftName }
  const [topGifters, setTopGifters] = useState<Map<string, TopGifter>>(new Map());

  // Feed (max 30 items)
  const [feed, setFeed] = useState<FeedItem[]>([]);

  // Connection status
  const [status, setStatus] = useState<"waiting" | "connected" | "disconnected">("waiting");

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addFeed = useCallback((item: Omit<FeedItem, "id" | "ts">) => {
    setFeed(prev => [
      { ...item, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ...prev.slice(0, 29),
    ]);
  }, []);

  const moveLane = useCallback((laneId: string, steps: number) => {
    if (winner || !config) return;

    setProgress(prev => {
      const next = { ...prev };
      next[laneId] = (next[laneId] || 0) + steps;

      if (next[laneId] >= config.stepLimit) {
        setWinner(config.lanes.find(l => l.id === laneId) || null);
      }
      return next;
    });
  }, [winner, config]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUser) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("join-room", roomId);
    });
    socket.on("disconnect", () => setStatus("disconnected"));

    // Lắng nghe setup race từ trang Admin/Game settings
    socket.on("start-game", (gameConfig: RaceConfig) => {
      setConfig(gameConfig);
      setProgress({});
      setWinner(null);
      setTotalLikes(0);
      setTotalGifts(0);
      setTotalDiamonds(0);
      setTopGifters(new Map());
      setFeed([]);
    });

    // Per-game events (from gameSessionService.js)
    socket.on(`${NS}:like`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setTotalLikes(n => n + count);
      addFeed({
        type: "like",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: `thả ${count} ❤️`,
        amount: count,
      });
    });

    socket.on(`${NS}:gift`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      const diamonds = (data.diamonds || 1) * count;
      setTotalGifts(n => n + count);
      setTotalDiamonds(n => n + diamonds);

      const giftName = data.giftName || "";

      // Update top gifters
      setTopGifters(prev => {
        const next = new Map(prev);
        const key = data.username || "Fan";
        const existing = next.get(key) || { username: key, avatar: data.profilePicture, total: 0 };
        next.set(key, {
          ...existing,
          total: existing.total + diamonds,
          giftName,
          avatar: data.profilePicture || existing.avatar,
        });
        return next;
      });

      addFeed({
        type: "gift",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: `tặng ${giftName || "quà"} x${count}`,
        giftImg: data.giftPictureUrl,
        amount: count,
      });

      // Race logic: Move lane matching gift
      if (config && !winner) {
        config.lanes.forEach(lane => {
          if (lane.gift && giftName.toLowerCase().includes(lane.gift.toLowerCase())) {
            moveLane(lane.id, count * 5); // 1 gift = 5 steps
          }
        });
      }
    });

    socket.on(`${NS}:chat`, (data: any) => {
      const comment = data.comment || "";
      addFeed({
        type: "chat",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: comment,
      });

      // Race logic: Move lane matching chat flag
      if (config && !winner) {
        config.lanes.forEach(lane => {
          if (lane.flag && comment.includes(lane.flag)) {
            moveLane(lane.id, 1); // 1 comment = 1 step
          }
        });
      }
    });

    socket.on(`${NS}:disconnected`, () => setStatus("disconnected"));

    return () => { socket.disconnect(); };
  }, [config, winner, moveLane, addFeed, targetUser, roomId]);

  // Top 3 gifters sorted
  const top3 = [...topGifters.values()].sort((a, b) => b.total - a.total).slice(0, 3);

  if (!targetUser) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050816", color: "#fff" }}>
        <p>⚠️ Thiếu TikTok ID. Hãy copy link từ bảng điều khiển.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden text-white select-none bg-[#050816]"
      style={{
        background: "linear-gradient(180deg,#050816 0%,#090d22 100%)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      {/* ── Background decoration ── */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle at center, transparent 0%, #000 100%), repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.05) 40px, rgba(255,255,255,0.05) 80px)",
      }} />

      {/* ── Status badge (Click to toggle fullscreen) ── */}
      <button 
        onClick={toggleFullscreen}
        className="absolute top-3 left-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-xs font-semibold hover:bg-black/60 transition-colors"
        title="Nhấn để mở/đóng toàn màn hình"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-emerald-400 animate-pulse" : status === "disconnected" ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
        <span className={status === "connected" ? "text-emerald-300" : status === "disconnected" ? "text-red-300" : "text-yellow-300"}>
          {status === "connected" ? "Đang live" : status === "disconnected" ? "Mất kết nối" : "Chờ kết nối..."}
        </span>
      </button>

      {/* ── Main layout ── */}
      <div className="flex h-full gap-3 p-3 pt-12 relative z-10">

        {/* ── Left panel ── */}
        <div className="flex flex-col gap-3 w-60 flex-shrink-0">
          {/* Stats */}
          <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur p-4 space-y-3">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">📊 Thống kê session</p>
            <StatRow icon="❤️" label="Like" value={totalLikes} color="text-red-400" />
            <StatRow icon="🎁" label="Quà" value={totalGifts} color="text-fuchsia-400" />
            <StatRow icon="💎" label="Diamond" value={totalDiamonds} color="text-cyan-400" />
            <StatRow icon="🏁" label="Đích đến" value={config?.stepLimit || 0} color="text-yellow-400" />
          </div>

          {/* Top Gifters */}
          <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur p-4 flex-1 overflow-hidden">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-3">🏆 Bảng xếp hạng quà</p>
            {top3.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8">Chưa có quà nào</p>
            ) : (
              <div className="space-y-3">
                {top3.map((g, i) => (
                  <div key={g.username} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                    i === 0 ? "bg-yellow-500/10 border-yellow-500/20" :
                    i === 1 ? "bg-slate-400/10 border-slate-400/20" :
                    "bg-orange-700/10 border-orange-700/20"
                  }`}>
                    <span className="text-xl w-7 text-center flex-shrink-0">{MEDALS[i]}</span>
                    {g.avatar ? (
                      <img src={g.avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/20" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 font-bold">
                        {g.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">@{g.username}</p>
                      <p className={`text-sm font-black ${
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-400"
                      }`}>💎 {g.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Race Track ── */}
        <div className="flex-1 relative flex flex-col items-center justify-center min-w-0">
          {!config ? (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
              <span className="text-6xl animate-bounce">🏎️</span>
              <p className="text-xl font-bold">Chờ Admin thiết lập và bắt đầu...</p>
            </div>
          ) : (
            <div className="w-full max-w-4xl flex flex-col gap-6 relative">
              {/* Header Info */}
              <div className="text-center mb-8">
                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-sm uppercase tracking-wider">
                  Đua Xe TikTok
                </h1>
                <p className="text-xl text-yellow-300/80 font-bold mt-2">Bình luận Emoji hoặc tặng Quà để tăng tốc</p>
              </div>

              {/* Finish Line (background target) */}
              <div className="absolute right-[5%] top-[100px] bottom-0 w-12 z-0 opacity-40 pointer-events-none" style={{
                backgroundImage: "repeating-linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%, #fff), repeating-linear-gradient(45deg, #fff 25%, #000 25%, #000 75%, #fff 75%, #fff)",
                backgroundPosition: "0 0, 10px 10px",
                backgroundSize: "20px 20px"
              }}></div>

              {/* Lanes */}
              <div className="flex flex-col gap-8 w-full z-10 pr-[5%]">
                {config.lanes.map(lane => {
                  const currentScore = Math.min(progress[lane.id] || 0, config.stepLimit);
                  const percent = Math.min((currentScore / config.stepLimit) * 100, 100);
                  
                  return (
                    <div key={lane.id} className="relative w-full h-24 flex items-center bg-black/40 rounded-full border border-white/5 backdrop-blur-sm">
                      {/* Progress Bar Background */}
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out opacity-20" style={{
                        width: `${percent}%`,
                        backgroundColor: lane.color
                      }}></div>
                      
                      {/* Racer Info & Avatar */}
                      <div className="absolute z-20 left-4 flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center bg-black/60 rounded-xl p-2 border border-white/10 min-w-[80px]">
                          <span className="text-sm font-bold truncate w-full text-center" style={{ color: lane.color }}>{lane.name}</span>
                          <span className="text-2xl font-black text-white">{currentScore}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sm">
                          <span>💬 {lane.flag}</span>
                          <span className="text-white/30">|</span>
                          <span>🎁 {lane.gift}</span>
                        </div>
                      </div>

                      {/* Moving Car */}
                      <div 
                        className="absolute z-30 transition-all duration-300 ease-out transform -translate-x-1/2"
                        style={{ left: `max(200px, ${percent}%)` }}
                      >
                        <span className="text-[70px] filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] inline-block transform scale-x-[-1] leading-none">
                          {lane.emoji}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Game Over overlay */}
              {winner && (
                <div className="absolute inset-0 flex items-center justify-center z-50">
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-3xl"></div>
                  <div className="relative text-center space-y-6 transform scale-110 animate-[pop_300ms_ease-out]">
                    <span className="text-8xl">{winner.emoji}</span>
                    <p className="text-6xl font-black uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" style={{ color: winner.color }}>
                      {winner.name} CHIẾN THẮNG
                    </p>
                    <p className="text-2xl text-slate-300 font-bold">Với {config.stepLimit} điểm</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: Live Feed ── */}
        <div className="flex flex-col gap-3 w-64 flex-shrink-0">
          <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur p-4 flex-1 flex flex-col overflow-hidden">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              📡 Sự kiện Live
              {status === "connected" && (
                <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {feed.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-6">Đang chờ sự kiện...</p>
              ) : (
                feed.map(item => <FeedCard key={item.id} item={item} />)
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pop {
          0%   { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 3px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 9px; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatRow({ icon, label, value, color }: {
  icon: string; label: string; value: number | string; color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <span className={`text-sm font-black ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const cfg = {
    like: { border: "border-l-red-500/60", bg: "bg-red-500/5", badge: "bg-red-500/20 text-red-300" },
    gift: { border: "border-l-fuchsia-500/60", bg: "bg-fuchsia-500/5", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
    chat: { border: "border-l-sky-500/40", bg: "bg-sky-500/5", badge: "bg-sky-500/20 text-sky-300" },
  }[item.type];

  return (
    <div className={`flex items-start gap-2 px-2.5 py-2 rounded-xl border-l-2 ${cfg.border} ${cfg.bg}`}>
      {item.avatar ? (
        <img src={item.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
          {item.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold truncate max-w-[80px]">@{item.username}</span>
          {item.type !== "chat" && item.amount && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              {item.type === "like" ? `+${item.amount}❤️` : `x${item.amount}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {item.giftImg && (
            <img src={item.giftImg} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
          )}
          <p className="text-[10px] text-slate-400 truncate">{item.text}</p>
        </div>
      </div>
    </div>
  );
}
