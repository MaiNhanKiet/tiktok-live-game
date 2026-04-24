/**
 * BlockClickDisplay.tsx
 * Trang hiển thị game công khai (không cần đăng nhập).
 * Dùng để thêm vào OBS Browser Source.
 * Route: /game/block-click/display
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";
const GAME_KEY = "block_click";
const NS = `game:${GAME_KEY}`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Block {
  id: string;
  color: string;
  username: string;
  avatar?: string;
  giftImg?: string;
  type: "like" | "gift";
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

const COLORS = [
  "from-red-500 to-rose-600",
  "from-yellow-400 to-amber-500",
  "from-emerald-500 to-green-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-violet-600",
  "from-pink-500 to-fuchsia-600",
  "from-cyan-500 to-teal-600",
  "from-orange-500 to-red-500",
];

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BlockClickDisplay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const urlParams = new URLSearchParams(window.location.search);
  const isVertical = urlParams.get("layout") === "vertical";
  const targetUser = urlParams.get("u") || "";
  const roomId = `block_click:${targetUser}`;

  // Config state
  const [config, setConfig] = useState({ cols: 8, rows: 8, likesPerBlock: 1, giftsPerBlock: 1 });

  // Grid state
  const [cells, setCells] = useState<(Block | null)[]>(Array(64).fill(null));
  const [isGameOver, setIsGameOver] = useState(false);

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
  const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

  const addFeed = useCallback((item: Omit<FeedItem, "id" | "ts">) => {
    setFeed(prev => [
      { ...item, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ...prev.slice(0, 29),
    ]);
  }, []);

  const spawnBlock = useCallback((block: Omit<Block, "id">) => {
    setCells(prev => {
      const empties: number[] = [];
      prev.forEach((c, i) => { if (!c) empties.push(i); });
      if (!empties.length) {
        setIsGameOver(true);
        return prev;
      }
      const idx = empties[Math.floor(Math.random() * empties.length)];
      const next = [...prev];
      next[idx] = { ...block, id: `${Date.now()}-${Math.random()}` };
      return next;
    });
  }, []);

  const removeBlock = useCallback((idx: number) => {
    setCells(prev => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    setIsGameOver(false);
  }, []);

  const resetGame = useCallback(() => {
    setCells(Array(config.cols * config.rows).fill(null));
    setIsGameOver(false);
    // Removed: setTotalLikes(0), setTotalGifts(0), setTotalDiamonds(0), setTopGifters, setFeed
  }, [config.cols, config.rows]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUser) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("join-room", roomId);
    });
    socket.on("disconnect", () => setStatus("disconnected"));

    // Listen to config setup
    socket.on("setup-block-click", (newConfig: any) => {
      if (newConfig && newConfig.cols && newConfig.rows) {
        setConfig(newConfig);
        setCells(Array(newConfig.cols * newConfig.rows).fill(null));
        setIsGameOver(false);
      }
    });

    // Per-game events
    socket.on(`${NS}:like`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setTotalLikes(n => n + count);
      
      const blocksToAdd = Math.floor(count / (config.likesPerBlock || 1)) || 1;
      for (let i = 0; i < Math.min(blocksToAdd, 10); i++) {
        spawnBlock({
          color: randomColor(),
          username: data.username || "Fan",
          avatar: data.profilePicture,
          type: "like",
        });
      }
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

      // Update top gifters
      setTopGifters(prev => {
        const next = new Map(prev);
        const key = data.username || "Fan";
        const existing = next.get(key) || { username: key, avatar: data.profilePicture, total: 0 };
        next.set(key, {
          ...existing,
          total: existing.total + diamonds,
          giftName: data.giftName,
          avatar: data.profilePicture || existing.avatar,
        });
        return next;
      });

      const blocksToAdd = (count * (config.giftsPerBlock || 1));
      for (let i = 0; i < Math.min(blocksToAdd, 20); i++) {
        spawnBlock({
          color: randomColor(),
          username: data.username || "Fan",
          avatar: data.profilePicture,
          giftImg: data.giftPictureUrl,
          type: "gift",
        });
      }
      addFeed({
        type: "gift",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: `tặng ${data.giftName || "quà"} x${count}`,
        giftImg: data.giftPictureUrl,
        amount: count,
      });
    });

    socket.on(`${NS}:chat`, (data: any) => {
      addFeed({
        type: "chat",
        username: data.username || "Fan",
        avatar: data.profilePicture,
        text: data.comment || "",
      });
    });

    socket.on(`${NS}:disconnected`, () => setStatus("disconnected"));

    return () => { socket.disconnect(); };
  }, [spawnBlock, addFeed, config.likesPerBlock, config.giftsPerBlock, targetUser, roomId]);

  // Top 5 gifters sorted
  const top5 = [...topGifters.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  const activeBlocks = cells.filter(Boolean).length;

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
      className="relative w-full h-screen overflow-hidden text-white select-none"
      style={{
        background: "radial-gradient(circle at top, rgba(99,102,241,0.22) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(236,72,153,0.14) 0%, transparent 30%), linear-gradient(180deg,#050816 0%,#090d22 100%)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      {/* ── Status badge (Click to toggle fullscreen) ── */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 left-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur border border-white/10 text-xs font-semibold hover:bg-black/60 transition-colors cursor-pointer"
        title={isFullscreen ? "Nhấn để thoát toàn màn hình" : "Nhấn để mở toàn màn hình"}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${status === "connected" ? "bg-emerald-400 animate-pulse" : status === "disconnected" ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
        <span className={status === "connected" ? "text-emerald-300" : status === "disconnected" ? "text-red-300" : "text-yellow-300"}>
          {status === "connected" ? "Đang live" : status === "disconnected" ? "Mất kết nối" : "Chờ kết nối..."}
        </span>
      </button>

      {/* ── Main layout ── */}
      {isVertical ? (
        <div className="flex flex-col h-full gap-2 p-2 pt-12">
          {/* Stats Bar */}
          <div className="flex items-center justify-around rounded-xl border border-white/10 bg-black/50 backdrop-blur py-2 px-1 text-[11px] font-bold">
            <div className="flex items-center gap-1 text-red-400">❤️ {totalLikes}</div>
            <div className="flex items-center gap-1 text-fuchsia-400">🎁 {totalGifts}</div>
            <div className="flex items-center gap-1 text-cyan-400">💎 {totalDiamonds}</div>
            <div className="flex items-center gap-1 text-slate-300">🧊 {activeBlocks}/{config.cols * config.rows}</div>
          </div>

          {/* Grid Area */}
          <div className="flex-1 relative w-full min-h-0 flex items-center justify-center">
            <div
              className="relative w-full aspect-square max-h-full"
              style={{ display: "grid", gridTemplateColumns: `repeat(${config.cols}, 1fr)`, gridTemplateRows: `repeat(${config.rows}, 1fr)`, gap: 3, padding: 3 }}
            >
              {cells.map((block, idx) => {
                const isGift = block?.type === "gift";
                return (
                  <div
                    key={idx}
                    onClick={() => removeBlock(idx)}
                    className={`relative rounded-xl overflow-hidden border bg-slate-900/70 cursor-pointer transition-all active:scale-95 ${
                      block ? (isGift ? "border-yellow-400/80 shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10" : "border-white/10") : "border-white/10"
                    }`}
                  >
                    {block && (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${block.color} flex flex-col items-center justify-center gap-0.5 animate-[pop_180ms_ease-out] ${isGift ? "animate-[pulse_1.5s_ease-in-out_infinite]" : ""}`}
                      >
                        {isGift && <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_center,_transparent_0%,_#FBBF24_150%)]"></div>}
                        {block.giftImg ? (
                          <img src={block.giftImg} alt="" className="w-8 h-8 object-contain drop-shadow-lg z-10 scale-110" />
                        ) : block.avatar ? (
                          <img src={block.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/50 z-10" />
                        ) : (
                          <span className="text-xl z-10 drop-shadow-md">{block.type === "gift" ? "🎁" : "❤️"}</span>
                        )}
                        <p className={`text-[9px] font-black text-white/100 truncate w-full text-center px-0.5 leading-tight z-10 ${isGift ? "drop-shadow-[0_0_4px_black]" : "drop-shadow-md"}`}>
                          {block.username}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              {isGameOver && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm z-10">
                  <div className="text-center space-y-2">
                    <p className="text-3xl font-black text-red-400">GAME OVER</p>
                    <button onClick={resetGame} className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs">Chơi lại</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Area (Top & Feed) */}
          <div className="h-[35%] flex gap-2">
            {/* Top 5 */}
            <div className="w-[40%] rounded-xl border border-white/10 bg-black/40 backdrop-blur p-2 flex flex-col overflow-hidden">
              <p className="text-[10px] text-slate-500 font-bold mb-2">🏆 TOP QUÀ</p>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {top5.map((g, i) => (
                  <div key={g.username} className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                    i === 0 ? "bg-yellow-500/10 border-yellow-500/20" :
                    i === 1 ? "bg-slate-400/10 border-slate-400/20" :
                    "bg-white/5 border-white/10"
                  }`}>
                    <span className="text-sm w-4 text-center">{MEDALS[i]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold truncate">@{g.username}</p>
                      <p className={`text-[10px] font-black ${i === 0 ? "text-yellow-400" : "text-slate-300"}`}>💎 {g.total}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feed */}
            <div className="w-[60%] rounded-xl border border-white/10 bg-black/40 backdrop-blur p-2 flex flex-col overflow-hidden">
              <p className="text-[10px] text-slate-500 font-bold mb-2">📡 LIVE FEED</p>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {feed.map(item => <FeedCard key={item.id} item={item} isSmall />)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full gap-3 p-3 pt-12">
          {/* ── Left panel ── */}
          <div className="flex flex-col gap-3 w-60 flex-shrink-0">

            {/* Stats */}
            <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur p-4 space-y-3">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">📊 Thống kê session</p>
              <StatRow icon="❤️" label="Like" value={totalLikes} color="text-red-400" />
              <StatRow icon="🎁" label="Quà" value={totalGifts} color="text-fuchsia-400" />
              <StatRow icon="💎" label="Diamond" value={totalDiamonds} color="text-cyan-400" />
              <StatRow icon="🧊" label="Khối" value={`${activeBlocks} / ${config.cols * config.rows}`} color="text-slate-200" />
            </div>

          {/* Top Gifters */}
          <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur p-4 flex-1 overflow-hidden">
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-3">🏆 Bảng xếp hạng quà</p>
            {top5.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8">Chưa có quà nào</p>
            ) : (
              <div className="space-y-3">
                {top5.map((g, i) => (
                  <div key={g.username} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                    i === 0 ? "bg-yellow-500/10 border-yellow-500/20" :
                    i === 1 ? "bg-slate-400/10 border-slate-400/20" :
                    i === 2 ? "bg-orange-700/10 border-orange-700/20" :
                    "bg-white/5 border-white/10"
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
                        i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-400"
                      }`}>💎 {g.total.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Game Grid ── */}
        <div className="flex-1 relative flex items-center justify-center min-w-0">
          {/* Grid */}
          <div
            className="relative w-full h-full"
            style={{ display: "grid", gridTemplateColumns: `repeat(${config.cols}, 1fr)`, gridTemplateRows: `repeat(${config.rows}, 1fr)`, gap: 6, padding: 6 }}
          >
            {cells.map((block, idx) => {
              const isGift = block?.type === "gift";
              return (
                <div
                  key={idx}
                  onClick={() => removeBlock(idx)}
                  className={`relative rounded-xl overflow-hidden border bg-slate-900/70 cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                    block ? (isGift ? "border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-10" : "border-white/10") : "border-white/10"
                  }`}
                >
                  {block && (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${block.color} flex flex-col items-center justify-center gap-0.5 animate-[pop_180ms_ease-out] ${isGift ? "animate-[pulse_1.5s_ease-in-out_infinite]" : ""}`}
                      style={{ animation: "pop 180ms ease-out" }}
                    >
                      {/* Special effects for gift block */}
                      {isGift && (
                        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_center,_transparent_0%,_#FBBF24_150%)]"></div>
                      )}
                      
                      {/* Gift image or avatar */}
                      {block.giftImg ? (
                        <img src={block.giftImg} alt="" className="w-10 h-10 object-contain drop-shadow-lg z-10 scale-110" />
                      ) : block.avatar ? (
                        <img src={block.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/50 z-10" />
                      ) : (
                        <span className="text-2xl z-10 drop-shadow-md">{block.type === "gift" ? "🎁" : "❤️"}</span>
                      )}
                      <p className={`text-[11px] font-black text-white/100 truncate w-full text-center px-1 leading-tight z-10 ${isGift ? "drop-shadow-[0_0_4px_black]" : "drop-shadow-md"}`}>
                        {block.username}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Game Over overlay */}
            {isGameOver && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm z-10">
                <div className="text-center space-y-3">
                  <p className="text-4xl font-black text-red-400">GAME OVER</p>
                  <p className="text-slate-300 text-sm">Bàn đã đầy. Click khối để xóa.</p>
                  <button
                    onClick={resetGame}
                    className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all"
                  >
                    Chơi lại
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: Live Feed ── */}
        <div className="flex flex-col gap-3 w-56 flex-shrink-0">
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4 flex-1 flex flex-col overflow-hidden">
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

          {/* Hướng dẫn */}
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-3 space-y-1">
            <p className="text-[10px] text-slate-500">❤️ Like → Tạo khối</p>
            <p className="text-[10px] text-slate-500">🎁 Gift → Tạo khối</p>
            <p className="text-[10px] text-slate-500">🖱️ Click khối để xóa</p>
          </div>
        </div>
        </div>
      )}

      {/* pop animation keyframes */}
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

function FeedCard({ item, isSmall }: { item: FeedItem, isSmall?: boolean }) {
  const cfg = {
    like: { border: "border-l-red-500/60", bg: "bg-red-500/5", badge: "bg-red-500/20 text-red-300" },
    gift: { border: "border-l-fuchsia-500/60", bg: "bg-fuchsia-500/5", badge: "bg-fuchsia-500/20 text-fuchsia-300" },
    chat: { border: "border-l-sky-500/40", bg: "bg-sky-500/5", badge: "bg-sky-500/20 text-sky-300" },
  }[item.type];

  return (
    <div className={`flex items-start gap-2 px-2.5 py-1.5 rounded-xl border-l-2 ${cfg.border} ${cfg.bg}`}>
      {/* Avatar */}
      {item.avatar ? (
        <img src={item.avatar} alt="" className={`${isSmall ? "w-5 h-5" : "w-7 h-7"} rounded-full object-cover flex-shrink-0 mt-0.5`} />
      ) : (
        <div className={`${isSmall ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]"} rounded-full bg-white/10 flex items-center justify-center font-bold flex-shrink-0 mt-0.5`}>
          {item.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${isSmall ? "text-[9px]" : "text-[11px]"} font-bold truncate max-w-[80px]`}>@{item.username}</span>
          {item.type !== "chat" && item.amount && (
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full ${cfg.badge}`}>
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
