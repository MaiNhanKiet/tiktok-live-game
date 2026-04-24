import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3000/api";
const SOCKET_URL = "http://localhost:3000";
const GAME_KEY = "block_click";

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserInfo {
  _id: string;
  username: string;
  role: string;
  tiktokId: string;
}

interface LiveEvent {
  id: string;
  type: "like" | "gift" | "chat";
  username: string;
  detail: string;
  time: string;
  profilePicture?: string;
}

interface LiveStats {
  likes: number;
  gifts: number;
  chats: number;
  blocks: number;
}

type Tab = "settings" | "live";

function getToken() {
  return localStorage.getItem("token") || "";
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// ─── Grid Config ─────────────────────────────────────────────────────────────
interface GridConfig {
  cols: number;
  rows: number;
  likesPerBlock: number;
  giftsPerBlock: number;
  isVertical?: boolean;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BlockClickGame() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState<LiveStats>({ likes: 0, gifts: 0, chats: 0, blocks: 0 });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [config, setConfig] = useState<GridConfig>({
    cols: 8, rows: 8, likesPerBlock: 1, giftsPerBlock: 1, isVertical: false,
  });
  const socketRef = useRef<Socket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // ── Load user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    axios.get(`${API}/user/me`, { headers: authHeaders() })
      .then(({ data }) => setUser(data.user))
      .catch(() => { navigate("/login"); });
  }, [navigate]);

  // ── Socket ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    const roomId = `block_click:${user?.tiktokId || ""}`;

    socket.on("connect", () => {
      if (user?.tiktokId) socket.emit("join-room", roomId);
    });

    socket.on(`game:${GAME_KEY}:like`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setStats(s => ({ ...s, likes: s.likes + count }));
      addEvent("like", data.username, `+${count} ❤️`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:gift`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setStats(s => ({ ...s, gifts: s.gifts + count }));
      addEvent("gift", data.username, `🎁 ${data.giftName} x${count}`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:chat`, (data: any) => {
      setStats(s => ({ ...s, chats: s.chats + 1 }));
      addEvent("chat", data.username, `💬 ${data.comment}`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:disconnected`, () => {
      setConnected(false);
      toast.error("TikTok Live đã ngắt kết nối");
    });

    return () => { socket.disconnect(); };
  }, [user?.tiktokId]);

  // Auto scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  function addEvent(type: LiveEvent["type"], username: string, detail: string, profilePicture?: string) {
    const event: LiveEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type, username, detail,
      time: new Date().toLocaleTimeString("vi-VN"),
      profilePicture,
    };
    setEvents(prev => [...prev.slice(-199), event]);
  }

  const handleConnect = useCallback(async () => {
    if (!user?.tiktokId) {
      toast.error("Bạn chưa cài TikTok ID trong hồ sơ!");
      return;
    }
    setConnecting(true);
    try {
      await axios.post(`${API}/games/${GAME_KEY}/start-session`, {
        tiktokUsername: user.tiktokId,
      });
      setConnected(true);
      setStats({ likes: 0, gifts: 0, chats: 0, blocks: 0 });
      setEvents([]);
      toast.success(`Đã kết nối @${user.tiktokId}!`);
      
      // Auto apply config when connecting
      if (socketRef.current) {
        socketRef.current.emit("setup-block-click", { ...config, roomId: `block_click:${user.tiktokId}` });
      }
      
      setTab("live");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Kết nối thất bại");
    } finally {
      setConnecting(false);
    }
  }, [user, config]);

  const handleDisconnect = useCallback(async () => {
    if (!user?.tiktokId) return;
    try {
      await axios.post(`${API}/games/${GAME_KEY}/stop-session`, { tiktokUsername: user.tiktokId });
      setConnected(false);
      toast.info("Đã ngắt kết nối");
    } catch {
      setConnected(false);
    }
  }, [user?.tiktokId]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816]">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#050816] text-white flex flex-col"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-sm"
            title="Về Dashboard"
          >
            ←
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg">
            🧊
          </div>
          <div>
            <p className="font-black text-base leading-tight">Khối Màu Tương Tác</p>
            <p className="text-xs text-slate-500">Block Click Game</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            connected
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-slate-800 border-white/10 text-slate-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {connected ? `@${user.tiktokId}` : "Chưa kết nối"}
          </div>

          {/* TikTok ID display */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-500 text-xs">@</span>
            <span className="text-sm font-semibold text-cyan-300">
              {user.tiktokId || <span className="text-slate-500 italic">Chưa có TikTok ID</span>}
            </span>
          </div>
        </div>
      </nav>

      {/* ── Tabs ── */}
      <div className="flex border-b border-white/10 bg-white/[0.02] px-6">
        {[
          { id: "settings" as Tab, label: "⚙️ Cài đặt & Kết nối" },
          { id: "live" as Tab, label: "📡 Theo dõi Live" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              tab === t.id
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
            {t.id === "live" && connected && (
              <span className="ml-2 inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">

        {/* ═══════ SETTINGS TAB ═══════ */}
        {tab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* TikTok Kết nối */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black mb-1">🔗 Kết nối TikTok Live</h2>
                <p className="text-slate-400 text-sm">Kết nối với phiên livestream của bạn</p>
              </div>

              {/* TikTok ID (read-only from profile) */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium flex items-center gap-2">
                  TikTok ID
                  <span className="text-[10px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">Từ hồ sơ</span>
                </label>
                <div className="flex items-center gap-3 bg-[#0d1229] border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-slate-500 text-sm">@</span>
                  <span className={`flex-1 font-semibold ${user.tiktokId ? "text-cyan-300" : "text-slate-500 italic text-sm"}`}>
                    {user.tiktokId || "Chưa cài đặt — vào Hồ sơ để thêm"}
                  </span>
                  {user.tiktokId && (
                    <span className="text-emerald-400 text-xs">✓</span>
                  )}
                </div>
                {!user.tiktokId && (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    → Cập nhật TikTok ID trong Hồ sơ
                  </button>
                )}
              </div>

              {/* Connect / Disconnect button */}
              {!connected ? (
                <button
                  onClick={handleConnect}
                  disabled={connecting || !user.tiktokId}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {connecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang kết nối...
                    </>
                  ) : (
                    <>🚀 Bắt đầu kết nối</>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                    <div>
                      <p className="text-emerald-300 font-semibold text-sm">Đang kết nối Live</p>
                      <p className="text-slate-400 text-xs">@{user.tiktokId}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="w-full h-10 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all"
                  >
                    🔌 Ngắt kết nối
                  </button>
                </div>
              )}

              {/* OBS Link */}
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500 font-medium">🎥 Thêm vào Browser Source (OBS)</p>
                  <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                    <button 
                      onClick={() => setConfig(c => ({ ...c, isVertical: false }))}
                      className={`px-2 py-0.5 text-[9px] rounded-md transition-all ${!config.isVertical ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-500 hover:text-slate-300"}`}
                    >16:9 Ngang</button>
                    <button 
                      onClick={() => setConfig(c => ({ ...c, isVertical: true }))}
                      className={`px-2 py-0.5 text-[9px] rounded-md transition-all ${config.isVertical ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-500 hover:text-slate-300"}`}
                    >9:16 Dọc</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[#0d1229] border border-white/10 rounded-xl px-3 py-2">
                  <code className="text-cyan-400/80 text-[10px] flex-1 truncate">
                    http://localhost:5173/game/block-click/display?u={user.tiktokId || "your-id"}{config.isVertical ? "&layout=vertical" : ""}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`http://localhost:5173/game/block-click/display?u=${user.tiktokId || "your-id"}${config.isVertical ? "&layout=vertical" : ""}`);
                      toast.success("Đã copy link!");
                    }}
                    className="text-slate-500 hover:text-white transition-colors text-xs px-2 flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <a
                  href={`/game/block-click/display?u=${user.tiktokId || ""}${config.isVertical ? "&layout=vertical" : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold transition-all"
                >
                  ⛶ Mở màn hình game
                </a>
              </div>
            </div>

            {/* Grid Config */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black mb-1">🎮 Cài đặt Grid</h2>
                <p className="text-slate-400 text-sm">Tuỳ chỉnh kích thước bảng game</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <ConfigSlider
                  label="Số cột"
                  value={config.cols}
                  min={4} max={12}
                  onChange={v => setConfig(c => ({ ...c, cols: v }))}
                />
                <ConfigSlider
                  label="Số hàng"
                  value={config.rows}
                  min={4} max={12}
                  onChange={v => setConfig(c => ({ ...c, rows: v }))}
                />
                <ConfigSlider
                  label="Like → 1 khối"
                  value={config.likesPerBlock}
                  min={1} max={20}
                  onChange={v => setConfig(c => ({ ...c, likesPerBlock: v }))}
                />
                <ConfigSlider
                  label="Gift → khối"
                  value={config.giftsPerBlock}
                  min={1} max={10}
                  onChange={v => setConfig(c => ({ ...c, giftsPerBlock: v }))}
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Xem trước grid</p>
                <div className="w-full h-36 bg-[#0d1229] rounded-xl border border-white/10 p-2 overflow-hidden">
                  <div
                    className="w-full h-full"
                    style={{ display: "grid", gridTemplateColumns: `repeat(${config.cols}, 1fr)`, gridTemplateRows: `repeat(${config.rows}, 1fr)`, gap: 2 }}
                  >
                    {Array.from({ length: config.cols * config.rows }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-sm bg-cyan-500/10 border border-cyan-500/10"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-right">
                  {config.cols * config.rows} ô tổng cộng
                </p>
                <button
                  onClick={() => {
                    if (socketRef.current && user?.tiktokId) {
                      socketRef.current.emit("setup-block-click", { ...config, roomId: `block_click:${user.tiktokId}` });
                      toast.success("Đã áp dụng cấu hình mới!");
                    } else {
                      toast.error("Chưa kết nối máy chủ hoặc thiếu TikTok ID");
                    }
                  }}
                  className="w-full mt-2 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-sm font-bold border border-cyan-500/30 transition-all"
                >
                  ✨ Áp dụng cấu hình
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ LIVE TAB ═══════ */}
        {tab === "live" && (
          <div className="space-y-6">
            {!connected && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 text-xl">⚠️</span>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">Chưa kết nối Live</p>
                  <button onClick={() => setTab("settings")} className="text-xs text-slate-400 hover:text-white">
                    → Sang tab Cài đặt để kết nối
                  </button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon="❤️" label="Lượt Like" value={stats.likes} color="text-red-400" />
              <StatCard icon="🎁" label="Quà tặng" value={stats.gifts} color="text-fuchsia-400" />
              <StatCard icon="💬" label="Chat" value={stats.chats} color="text-sky-400" />
              <StatCard icon="🧊" label="Khối đã tạo" value={stats.blocks} color="text-cyan-400" />
            </div>

            {/* Event feed */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  📡 Sự kiện Live
                  {connected && (
                    <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />
                      LIVE
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setEvents([])}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Xóa
                </button>
              </div>

              <div className="overflow-y-auto max-h-[460px] divide-y divide-white/5">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm">{connected ? "Đang chờ sự kiện..." : "Kết nối để xem sự kiện"}</p>
                  </div>
                ) : (
                  [...events].reverse().map(ev => (
                    <EventRow key={ev.id} event={ev} />
                  ))
                )}
                <div ref={eventsEndRef} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigSlider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400 font-medium">{label}</label>
        <span className="text-sm font-bold text-cyan-300 w-7 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer"
      />
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className={`text-3xl font-black ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function EventRow({ event }: { event: LiveEvent }) {
  const typeConfig = {
    like: { bg: "bg-red-500/10", border: "border-red-500/20", badge: "bg-red-500/20 text-red-400" },
    gift: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", badge: "bg-fuchsia-500/20 text-fuchsia-400" },
    chat: { bg: "bg-sky-500/10", border: "border-sky-500/20", badge: "bg-sky-500/20 text-sky-400" },
  }[event.type];

  return (
    <div className={`flex items-center gap-3 px-5 py-3 ${typeConfig.bg} border-l-2 ${typeConfig.border}`}>
      {event.profilePicture ? (
        <img src={event.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0">
          {event.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">@{event.username}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeConfig.badge}`}>
            {event.type.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate">{event.detail}</p>
      </div>
      <p className="text-xs text-slate-600 flex-shrink-0">{event.time}</p>
    </div>
  );
}
