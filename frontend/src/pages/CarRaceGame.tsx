import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3000/api";
const SOCKET_URL = "http://localhost:3000";
const GAME_KEY = "car_race";

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
}

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

type Tab = "settings" | "live";

function getToken() {
  return localStorage.getItem("token") || "";
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

const DEFAULT_LANES: LaneConfig[] = [
  { id: "1", name: "Đội Vàng", emoji: "🚕", flag: "💛", gift: "Rose", color: "#FBBF24" },
  { id: "2", name: "Đội Đỏ", emoji: "🏎️", flag: "❤️", gift: "TikTok", color: "#EF4444" },
  { id: "3", name: "Đội Xanh", emoji: "🚙", flag: "💙", gift: "GG", color: "#3B82F6" },
  { id: "4", name: "Đội Lục", emoji: "🚜", flag: "💚", gift: "Heart", color: "#10B981" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CarRaceGame() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState<LiveStats>({ likes: 0, gifts: 0, chats: 0 });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  
  const [config, setConfig] = useState<RaceConfig>({
    stepLimit: 100,
    lanes: DEFAULT_LANES,
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
    const roomId = `car_race:${user?.tiktokId || ""}`;

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

  // ── Start Race Game ────────────────────────────────────────────────────────
  const handleStartRace = useCallback(() => {
    if (socketRef.current && user?.tiktokId) {
      socketRef.current.emit("setup-race", { ...config, roomId: `car_race:${user.tiktokId}` });
      toast.success("Đã phát động cuộc đua!");
    }
  }, [config, user?.tiktokId]);

  // ── Connect ───────────────────────────────────────────────────────────────
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
      setStats({ likes: 0, gifts: 0, chats: 0 });
      setEvents([]);
      toast.success(`Đã kết nối @${user.tiktokId}!`);
      handleStartRace();
      setTab("live");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Kết nối thất bại");
    } finally {
      setConnecting(false);
    }
  }, [user, handleStartRace]);

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
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-lg">
            🏎️
          </div>
          <div>
            <p className="font-black text-base leading-tight">Đua Xe Tương Tác</p>
            <p className="text-xs text-slate-500">Car Race Game</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            connected
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-slate-800 border-white/10 text-slate-400"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {connected ? `@${user.tiktokId}` : "Chưa kết nối"}
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-slate-500 text-xs">@</span>
            <span className="text-sm font-semibold text-emerald-300">
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
                ? "border-emerald-400 text-emerald-300"
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

              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium flex items-center gap-2">
                  TikTok ID
                  <span className="text-[10px] bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded-full">Từ hồ sơ</span>
                </label>
                <div className="flex items-center gap-3 bg-[#0d1229] border border-white/10 rounded-xl px-4 py-3">
                  <span className="text-slate-500 text-sm">@</span>
                  <span className={`flex-1 font-semibold ${user.tiktokId ? "text-emerald-300" : "text-slate-500 italic text-sm"}`}>
                    {user.tiktokId || "Chưa cài đặt — vào Hồ sơ để thêm"}
                  </span>
                  {user.tiktokId && (
                    <span className="text-emerald-400 text-xs">✓</span>
                  )}
                </div>
              </div>

              {!connected ? (
                <button
                  onClick={handleConnect}
                  disabled={connecting || !user.tiktokId}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
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
                  <button
                    onClick={handleStartRace}
                    className="w-full h-10 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-sm font-semibold transition-all mt-2"
                  >
                    🏁 Bắt đầu cuộc đua mới
                  </button>
                </div>
              )}

              {/* OBS Link */}
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-slate-500 mb-2 font-medium">🎥 Thêm vào Browser Source (OBS)</p>
                <div className="flex items-center gap-2 bg-[#0d1229] border border-white/10 rounded-xl px-3 py-2">
                  <code className="text-emerald-400/80 text-xs flex-1 truncate">
                    http://localhost:5173/game/car-race/display?u={user.tiktokId || "your-id"}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`http://localhost:5173/game/car-race/display?u=${user.tiktokId || "your-id"}`);
                      toast.success("Đã copy link!");
                    }}
                    className="text-slate-500 hover:text-white transition-colors text-xs px-2 flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-1.5">Trang game công khai, không cần đăng nhập</p>
                <a
                  href={`/game/car-race/display?u=${user.tiktokId || ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition-all"
                >
                  ⛶ Mở màn hình game
                </a>
              </div>
            </div>

            {/* Config */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black mb-1">🏁 Cài đặt Đua Xe</h2>
                <p className="text-slate-400 text-sm">Tuỳ chỉnh làn đua và yêu cầu</p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400 font-medium">Điểm đến đích (Step Limit)</label>
                  <input 
                    type="number" 
                    value={config.stepLimit}
                    onChange={(e) => setConfig({ ...config, stepLimit: Number(e.target.value) })}
                    className="bg-[#0d1229] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-3 mt-4">
                  <label className="text-xs text-slate-400 font-medium">Danh sách xe đua</label>
                  {config.lanes.map((lane, idx) => (
                    <div key={lane.id} className="grid grid-cols-4 gap-2 bg-[#0d1229] border border-white/10 rounded-xl p-3">
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Emoji (Xe)</label>
                        <input value={lane.emoji} onChange={(e) => {
                          const newLanes = [...config.lanes];
                          newLanes[idx].emoji = e.target.value;
                          setConfig({ ...config, lanes: newLanes });
                        }} className="w-full bg-transparent border border-white/10 rounded p-1 text-xs text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Flag (Bình luận)</label>
                        <input value={lane.flag} onChange={(e) => {
                          const newLanes = [...config.lanes];
                          newLanes[idx].flag = e.target.value;
                          setConfig({ ...config, lanes: newLanes });
                        }} className="w-full bg-transparent border border-white/10 rounded p-1 text-xs text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Gift</label>
                        <input value={lane.gift} onChange={(e) => {
                          const newLanes = [...config.lanes];
                          newLanes[idx].gift = e.target.value;
                          setConfig({ ...config, lanes: newLanes });
                        }} className="w-full bg-transparent border border-white/10 rounded p-1 text-xs text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Màu</label>
                        <input type="color" value={lane.color} onChange={(e) => {
                          const newLanes = [...config.lanes];
                          newLanes[idx].color = e.target.value;
                          setConfig({ ...config, lanes: newLanes });
                        }} className="w-full h-7 bg-transparent rounded cursor-pointer" />
                      </div>
                    </div>
                  ))}
                </div>
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
            <div className="grid grid-cols-3 gap-4">
              <StatCard icon="❤️" label="Lượt Like" value={stats.likes} color="text-red-400" />
              <StatCard icon="🎁" label="Quà tặng" value={stats.gifts} color="text-fuchsia-400" />
              <StatCard icon="💬" label="Chat" value={stats.chats} color="text-sky-400" />
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
