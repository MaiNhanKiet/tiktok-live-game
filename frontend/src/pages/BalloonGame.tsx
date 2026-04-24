import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3000/api";
const SOCKET_URL = "http://localhost:3000";
const GAME_KEY = "balloon";

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
  pumps: number;
}

interface BalloonConfig {
  burstThreshold: number;
  likeMinCount: number; // min like count per event to trigger +1
}

type Tab = "settings" | "live";

function getToken() { return localStorage.getItem("token") || ""; }
function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }

const DEFAULT_CONFIG: BalloonConfig = {
  burstThreshold: 100,
  likeMinCount: 20,
};

export default function BalloonGame() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState<LiveStats>({ likes: 0, gifts: 0, chats: 0, pumps: 0 });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [config, setConfig] = useState<BalloonConfig>(DEFAULT_CONFIG);
  const socketRef = useRef<Socket | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    axios.get(`${API}/user/me`, { headers: authHeaders() })
      .then(({ data }) => setUser(data.user))
      .catch(() => navigate("/login"));
  }, [navigate]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    const roomId = `balloon:${user?.tiktokId || ""}`;
    
    socket.on("connect", () => {
      if (user?.tiktokId) socket.emit("join-room", roomId);
    });

    socket.on(`game:${GAME_KEY}:like`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      setStats(s => ({ ...s, likes: s.likes + count }));
      const pumped = count >= config.likeMinCount ? 1 : 0;
      if (pumped) setStats(s => ({ ...s, pumps: s.pumps + 1 }));
      addEvent("like", data.username, `+${count} ❤️${pumped ? " → +1 bơm" : ""}`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:gift`, (data: any) => {
      const count = Math.max(1, Number(data?.amount || 1));
      const diamonds = (data.diamonds || 1) * count;
      setStats(s => ({ ...s, gifts: s.gifts + count, pumps: s.pumps + diamonds }));
      addEvent("gift", data.username, `🎁 ${data.giftName} x${count} → +${diamonds} bơm`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:chat`, (data: any) => {
      setStats(s => ({ ...s, chats: s.chats + 1, pumps: s.pumps + 1 }));
      addEvent("chat", data.username, `💬 ${data.comment} → +1 bơm`, data.profilePicture);
    });

    socket.on(`game:${GAME_KEY}:disconnected`, () => {
      setConnected(false);
      toast.error("TikTok Live đã ngắt kết nối");
    });

    return () => { socket.disconnect(); };
  }, [config.likeMinCount, user?.tiktokId]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  function addEvent(type: LiveEvent["type"], username: string, detail: string, profilePicture?: string) {
    setEvents(prev => [...prev.slice(-199), {
      id: `${Date.now()}-${Math.random()}`,
      type, username, detail,
      time: new Date().toLocaleTimeString("vi-VN"),
      profilePicture,
    }]);
  }

  const handleStartGame = useCallback(() => {
    if (socketRef.current && user?.tiktokId) {
      socketRef.current.emit("setup-balloon", { ...config, roomId: `balloon:${user.tiktokId}` });
      toast.success("🎈 Đã khởi động game Balloon!");
    }
  }, [config, user?.tiktokId]);

  const handleReset = useCallback(() => {
    if (socketRef.current && user?.tiktokId) {
      socketRef.current.emit("balloon-reset", { roomId: `balloon:${user.tiktokId}` });
      toast.info("Đã reset bóng!");
    }
  }, [user?.tiktokId]);

  const handleConnect = useCallback(async () => {
    if (!user?.tiktokId) { toast.error("Bạn chưa cài TikTok ID trong hồ sơ!"); return; }
    setConnecting(true);
    try {
      await axios.post(`${API}/games/${GAME_KEY}/start-session`, { tiktokUsername: user.tiktokId });
      setConnected(true);
      setStats({ likes: 0, gifts: 0, chats: 0, pumps: 0 });
      setEvents([]);
      toast.success(`Đã kết nối @${user.tiktokId}!`);
      handleStartGame();
      setTab("live");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Kết nối thất bại");
    } finally {
      setConnecting(false);
    }
  }, [user, handleStartGame]);

  const handleDisconnect = useCallback(async () => {
    if (!user?.tiktokId) return;
    try {
      await axios.post(`${API}/games/${GAME_KEY}/stop-session`, { tiktokUsername: user.tiktokId });
      setConnected(false);
      toast.info("Đã ngắt kết nối");
    } catch { setConnected(false); }
  }, [user?.tiktokId]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816]">
        <div className="w-10 h-10 border-4 border-pink-500/30 border-t-pink-400 rounded-full animate-spin" />
      </div>
    );
  }

  const pumpPercent = Math.min((stats.pumps / config.burstThreshold) * 100, 100);

  return (
    <div className="min-h-screen bg-[#050816] text-white flex flex-col" style={{ fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-sm">←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-lg">🎈</div>
          <div>
            <p className="font-black text-base leading-tight">Bong Bóng Nước</p>
            <p className="text-xs text-slate-500">Balloon Game</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
          connected ? "bg-pink-500/15 border-pink-500/30 text-pink-300" : "bg-slate-800 border-white/10 text-slate-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-pink-400 animate-pulse" : "bg-slate-500"}`} />
          {connected ? `@${user.tiktokId}` : "Chưa kết nối"}
        </div>
      </nav>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-white/[0.02] px-6">
        {([
          { id: "settings" as Tab, label: "⚙️ Cài đặt & Kết nối" },
          { id: "live" as Tab, label: "📡 Theo dõi Live" },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              tab === t.id ? "border-pink-400 text-pink-300" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}>
            {t.label}
            {t.id === "live" && connected && (
              <span className="ml-2 inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />LIVE
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TikTok connect */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black mb-1">🔗 Kết nối TikTok Live</h2>
                <p className="text-slate-400 text-sm">Kết nối với phiên livestream của bạn</p>
              </div>
              <div className="flex items-center gap-3 bg-[#0d1229] border border-white/10 rounded-xl px-4 py-3">
                <span className="text-slate-500 text-sm">@</span>
                <span className={`flex-1 font-semibold ${user.tiktokId ? "text-pink-300" : "text-slate-500 italic text-sm"}`}>
                  {user.tiktokId || "Chưa cài đặt — vào Hồ sơ để thêm"}
                </span>
              </div>
              {!connected ? (
                <button onClick={handleConnect} disabled={connecting || !user.tiktokId}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20">
                  {connecting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang kết nối...</>) : "🚀 Bắt đầu kết nối"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
                    <span className="w-2.5 h-2.5 bg-pink-400 rounded-full animate-pulse flex-shrink-0" />
                    <div>
                      <p className="text-pink-300 font-semibold text-sm">Đang kết nối Live</p>
                      <p className="text-slate-400 text-xs">@{user.tiktokId}</p>
                    </div>
                  </div>
                  <button onClick={handleReset} className="w-full h-10 rounded-xl bg-pink-500 text-white hover:bg-pink-400 text-sm font-semibold transition-all">
                    🎈 Reset bóng mới
                  </button>
                  <button onClick={handleDisconnect} className="w-full h-10 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all">
                    🔌 Ngắt kết nối
                  </button>
                </div>
              )}
              {/* OBS link */}
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-slate-500 mb-2 font-medium">🎥 Thêm vào Browser Source (OBS)</p>
                <div className="flex items-center gap-2 bg-[#0d1229] border border-white/10 rounded-xl px-3 py-2">
                  <code className="text-pink-400/80 text-xs flex-1 truncate">
                    http://localhost:5173/game/balloon/display?u={user.tiktokId || "your-id"}
                  </code>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:5173/game/balloon/display?u=${user.tiktokId || "your-id"}`);
                    toast.success("Đã copy!");
                  }}
                    className="text-slate-500 hover:text-white transition-colors text-xs px-2 flex-shrink-0">Copy</button>
                </div>
                <a href={`/game/balloon/display?u=${user.tiktokId || ""}`} target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-pink-500/30 text-pink-400 hover:bg-pink-500/10 text-xs font-semibold transition-all">
                  ⛶ Mở màn hình game
                </a>
              </div>
            </div>

            {/* Config */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black mb-1">🎈 Cài đặt Balloon</h2>
                <p className="text-slate-400 text-sm">Tuỳ chỉnh ngưỡng nổ và điều kiện</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Ngưỡng nổ (Burst Threshold)</label>
                  <input type="number" value={config.burstThreshold} min={10}
                    onChange={e => setConfig(c => ({ ...c, burstThreshold: Number(e.target.value) }))}
                    className="w-full bg-[#0d1229] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500/50" />
                  <p className="text-[11px] text-slate-600">Tổng điểm bơm để quả bóng nổ</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Like tối thiểu để +1 bơm</label>
                  <input type="number" value={config.likeMinCount} min={1}
                    onChange={e => setConfig(c => ({ ...c, likeMinCount: Number(e.target.value) }))}
                    className="w-full bg-[#0d1229] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-500/50" />
                  <p className="text-[11px] text-slate-600">Mặc định: 1 lần like có ≥ {config.likeMinCount} tim → +1 bơm</p>
                </div>
                {/* Rule summary */}
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-300">📋 Luật bơm bóng</p>
                  {[
                    { icon: "💬", label: "Chat bất kỳ", value: "+1 bơm" },
                    { icon: "❤️", label: `Like ≥ ${config.likeMinCount} tim`, value: "+1 bơm" },
                    { icon: "🎁", label: "Tặng quà", value: "+diamonds × số lượng" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{r.icon} {r.label}</span>
                      <span className="text-pink-400 font-bold">{r.value}</span>
                    </div>
                  ))}
                </div>
                {connected && (
                  <button onClick={handleStartGame}
                    className="w-full h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 text-sm font-semibold transition-all">
                    🔄 Áp dụng cấu hình mới
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LIVE TAB */}
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

            {/* Pump progress */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-300">🎈 Trạng thái bóng</p>
                <p className="text-sm font-black text-pink-400">{stats.pumps} / {config.burstThreshold}</p>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pumpPercent}%`, background: `linear-gradient(90deg, #ec4899, #f43f5e ${pumpPercent}%)` }} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">{pumpPercent.toFixed(1)}% đã bơm</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: "❤️", label: "Like", value: stats.likes, color: "text-red-400" },
                { icon: "🎁", label: "Quà", value: stats.gifts, color: "text-fuchsia-400" },
                { icon: "💬", label: "Chat", value: stats.chats, color: "text-sky-400" },
                { icon: "💦", label: "Bơm", value: stats.pumps, color: "text-pink-400" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{s.icon}</span>
                    <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                  </div>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Event feed */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  📡 Sự kiện Live
                  {connected && (
                    <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" />LIVE
                    </span>
                  )}
                </h3>
                <button onClick={() => setEvents([])} className="text-xs text-slate-500 hover:text-slate-300">Xóa</button>
              </div>
              <div className="overflow-y-auto max-h-[400px] divide-y divide-white/5">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-3">
                    <span className="text-4xl">📭</span>
                    <p className="text-sm">{connected ? "Đang chờ sự kiện..." : "Kết nối để xem sự kiện"}</p>
                  </div>
                ) : (
                  [...events].reverse().map(ev => {
                    const cfg = {
                      like: { bg: "bg-red-500/10", border: "border-red-500/20", badge: "bg-red-500/20 text-red-400" },
                      gift: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", badge: "bg-fuchsia-500/20 text-fuchsia-400" },
                      chat: { bg: "bg-sky-500/10", border: "border-sky-500/20", badge: "bg-sky-500/20 text-sky-400" },
                    }[ev.type];
                    return (
                      <div key={ev.id} className={`flex items-center gap-3 px-5 py-3 ${cfg.bg} border-l-2 ${cfg.border}`}>
                        {ev.profilePicture
                          ? <img src={ev.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0">{ev.username.charAt(0).toUpperCase()}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">@{ev.username}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>{ev.type.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{ev.detail}</p>
                        </div>
                        <p className="text-xs text-slate-600 flex-shrink-0">{ev.time}</p>
                      </div>
                    );
                  })
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
