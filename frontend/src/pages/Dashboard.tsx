import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";

const API = "http://localhost:3000/api";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Game {
  key: string;
  name: string;
  icon: string;
  description?: string;
  hasAccess?: boolean;
}

interface UserInfo {
  _id: string;
  username: string;
  role: string;
  tiktokId: string;
  createdAt?: string;
  games?: Game[];
}

type ActiveView = "games" | "profile" | "admin";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("token") || "";
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// Games that have their own dedicated React page
const GAME_ROUTES: Record<string, string> = {
  block_click: "/game/block-click",
  car_race: "/game/car-race",
  balloon: "/game/balloon",
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("games");
  const [openGame, setOpenGame] = useState<Game | null>(null);

  // Admin state
  const [adminUsers, setAdminUsers] = useState<UserInfo[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedAdminUser, setSelectedAdminUser] = useState<UserInfo | null>(
    null,
  );

  // Profile state
  const [newPassword, setNewPassword] = useState("");
  const [newTiktokId, setNewTiktokId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Load current user ───────────────────────────────────────────────────────
  const loadMe = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/user/me`, {
        headers: authHeaders(),
      });
      setUser(data.user);
      setNewTiktokId(data.user.tiktokId || "");
    } catch {
      toast.error("Phiên đăng nhập hết hạn");
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  const loadMyGames = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/user/me/games`, {
        headers: authHeaders(),
      });
      setMyGames(data.games || []);
    } catch {
      setMyGames([]);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/login");
      return;
    }
    loadMe();
    loadMyGames();
  }, [loadMe, loadMyGames, navigate]);

  // ── Admin: Load all users ───────────────────────────────────────────────────
  const loadAdminUsers = useCallback(async () => {
    setAdminLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/users`, {
        headers: authHeaders(),
      });
      setAdminUsers(data.users || []);
    } catch {
      toast.error("Không thể tải danh sách users");
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "admin" && user?.role === "admin") {
      loadAdminUsers();
    }
  }, [activeView, user, loadAdminUsers]);

  // ── Admin: Toggle game access ───────────────────────────────────────────────
  const toggleGameAccess = async (
    userId: string,
    gameKey: string,
    current: boolean,
  ) => {
    try {
      await axios.put(
        `${API}/admin/users/${userId}/games/${gameKey}`,
        { hasAccess: !current },
        { headers: authHeaders() },
      );
      toast.success("Đã cập nhật quyền game!");
      // refresh
      await loadAdminUsers();
      // update selected user
      const updated = adminUsers.find((u) => u._id === userId);
      if (updated) {
        const { data } = await axios.get(`${API}/admin/users/${userId}`, {
          headers: authHeaders(),
        });
        setSelectedAdminUser(data.user);
      }
    } catch {
      toast.error("Cập nhật quyền thất bại");
    }
  };

  // ── Profile: Update ─────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (newPassword.trim()) payload.password = newPassword;
      if (newTiktokId !== user?.tiktokId) payload.tiktokId = newTiktokId;
      if (!Object.keys(payload).length) {
        toast.info("Không có thay đổi để lưu");
        return;
      }
      const { data } = await axios.put(`${API}/user/me`, payload, {
        headers: authHeaders(),
      });
      setUser(data.user);
      setNewPassword("");
      toast.success("Cập nhật thành công!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Cập nhật thất bại");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C46FF]/30 border-t-[#8C46FF] rounded-full animate-spin" />
          <p className="text-slate-400 font-medium">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#080810] text-white flex flex-col"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ── Top Navbar ── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8C46FF] to-[#FF46C8] flex items-center justify-center text-lg">
            🎮
          </div>
          <span className="font-black text-lg tracking-tight">
            TikTok Live Game
          </span>
        </div>

        <div className="flex items-center gap-1">
          {[
            { id: "games" as ActiveView, label: "Games", icon: "🕹️" },
            { id: "profile" as ActiveView, label: "Hồ sơ", icon: "👤" },
            ...(user.role === "admin"
              ? [{ id: "admin" as ActiveView, label: "Admin", icon: "⚙️" }]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeView === tab.id
                  ? "bg-[#8C46FF] text-white shadow-lg shadow-[#8C46FF]/30"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{user.username}</p>
            <p className="text-xs text-slate-400">
              {user.role === "admin" ? "👑 Admin" : "👤 User"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400/30 transition-all text-sm font-medium"
          >
            Đăng xuất
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 px-4 py-8 max-w-7xl mx-auto w-full">
        {/* ═══════════════ GAMES VIEW ═══════════════ */}
        {activeView === "games" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-1">
                Chào mừng,{" "}
                <span className="text-[#8C46FF]">{user.username}</span> 👋
              </h1>
              <p className="text-slate-400">
                Chọn game bên dưới để bắt đầu livestream
              </p>
            </div>

            {myGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6">
                <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center text-4xl border border-white/10">
                  🔒
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-300 mb-2">
                    Chưa có quyền truy cập game
                  </p>
                  <p className="text-slate-500 text-sm max-w-sm">
                    Vui lòng liên hệ Admin để được cấp quyền sử dụng game.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {myGames.map((game) => (
                  <GameCard
                    key={game.key}
                    game={game}
                    onClick={() => {
                      // Nếu game có trang riêng → navigate; còn lại mở iframe
                      if (GAME_ROUTES[game.key]) {
                        navigate(GAME_ROUTES[game.key]);
                      } else {
                        setOpenGame(game);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ PROFILE VIEW ═══════════════ */}
        {activeView === "profile" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="mb-6">
              <h1 className="text-3xl font-black mb-1">Hồ sơ của tôi</h1>
              <p className="text-slate-400">
                Quản lý thông tin tài khoản và bảo mật
              </p>
            </div>

            {/* User Info Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8C46FF] to-[#FF46C8] flex items-center justify-center text-3xl font-black">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-bold">{user.username}</p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-1 ${user.role === "admin" ? "bg-yellow-400/15 text-yellow-300" : "bg-[#8C46FF]/15 text-[#a97bff]"}`}
                  >
                    {user.role === "admin" ? "👑 Admin" : "👤 User"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <InfoRow
                  icon="🎮"
                  label="TikTok ID"
                  value={user.tiktokId || "Chưa cài đặt"}
                />
                <InfoRow
                  icon="📅"
                  label="Ngày tạo"
                  value={
                    user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("vi-VN")
                      : "—"
                  }
                />
                <InfoRow
                  icon="🕹️"
                  label="Số game"
                  value={`${user.games?.length || 0} game`}
                />
                <InfoRow icon="🔐" label="Vai trò" value={user.role} />
              </div>
            </div>

            {/* Games accessible */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="font-bold mb-4 text-slate-200 flex items-center gap-2">
                <span>🎮</span> Game của tôi
              </h3>
              {myGames.length === 0 ? (
                <p className="text-slate-500 text-sm">
                  Bạn chưa được cấp quyền game nào.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {myGames.map((g) => (
                    <span
                      key={g.key}
                      className="inline-flex items-center gap-2 bg-[#8C46FF]/15 border border-[#8C46FF]/30 text-[#c19eff] text-sm font-medium px-3 py-1.5 rounded-xl"
                    >
                      {g.icon} {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Edit form */}
            <form
              onSubmit={handleUpdateProfile}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5"
            >
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <span>✏️</span> Cập nhật thông tin
              </h3>

              <div className="space-y-1.5">
                <label className="text-sm text-slate-400 font-medium">
                  TikTok ID
                </label>
                <div className="flex items-center gap-2 bg-[#111122] border border-white/10 rounded-xl overflow-hidden focus-within:border-[#8C46FF]/60">
                  <span className="px-4 text-slate-500 text-lg">@</span>
                  <input
                    type="text"
                    value={newTiktokId}
                    onChange={(e) => setNewTiktokId(e.target.value)}
                    placeholder="username"
                    className="flex-1 bg-transparent py-3 pr-4 text-white outline-none placeholder:text-slate-600 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-slate-400 font-medium">
                  Mật khẩu mới{" "}
                  <span className="text-slate-600">
                    (để trống nếu không đổi)
                  </span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#111122] border border-white/10 rounded-xl px-4 py-3 text-white outline-none placeholder:text-slate-600 text-sm focus:border-[#8C46FF]/60 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full h-12 rounded-xl bg-[#8C46FF] hover:bg-[#7C36EF] text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#8C46FF]/25"
              >
                {profileLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                    Đang lưu...
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </form>
          </div>
        )}

        {/* ═══════════════ ADMIN VIEW ═══════════════ */}
        {activeView === "admin" && user.role === "admin" && (
          <div className="space-y-6">
            <div className="mb-2">
              <h1 className="text-3xl font-black mb-1 flex items-center gap-3">
                ⚙️ <span>Bảng Admin</span>
              </h1>
              <p className="text-slate-400">
                Quản lý người dùng và phân quyền game
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* User list */}
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-200">
                    Danh sách người dùng
                  </h3>
                  <button
                    onClick={loadAdminUsers}
                    className="text-xs text-[#8C46FF] hover:text-[#c19eff] transition-colors font-medium"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[600px]">
                  {adminLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 border-2 border-[#8C46FF]/30 border-t-[#8C46FF] rounded-full animate-spin" />
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                      Không có user nào
                    </div>
                  ) : (
                    adminUsers.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => setSelectedAdminUser(u)}
                        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors border-b border-white/5 last:border-0 ${
                          selectedAdminUser?._id === u._id
                            ? "bg-[#8C46FF]/15 border-l-2 border-l-[#8C46FF]"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8C46FF]/40 to-[#FF46C8]/40 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {u.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.role === "admin"
                              ? "👑 Admin"
                              : `🎮 ${u.games?.filter((g) => g.hasAccess).length || 0} game`}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* User detail / game access */}
              <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
                {!selectedAdminUser ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500 gap-3">
                    <span className="text-4xl">👈</span>
                    <p className="text-sm">
                      Chọn một người dùng để xem chi tiết
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* User header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8C46FF] to-[#FF46C8] flex items-center justify-center font-black text-2xl">
                          {selectedAdminUser.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xl font-bold">
                            {selectedAdminUser.username}
                          </p>
                          <p className="text-sm text-slate-400">
                            @{selectedAdminUser.tiktokId || "chưa cài"}
                          </p>
                          <span
                            className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1 ${selectedAdminUser.role === "admin" ? "bg-yellow-400/15 text-yellow-300" : "bg-blue-400/15 text-blue-300"}`}
                          >
                            {selectedAdminUser.role}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        {selectedAdminUser.createdAt
                          ? new Date(
                              selectedAdminUser.createdAt,
                            ).toLocaleDateString("vi-VN")
                          : ""}
                      </p>
                    </div>

                    {/* Game access controls */}
                    <div>
                      <h4 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2">
                        🎮 Phân quyền Game
                      </h4>
                      <div className="space-y-3">
                        {(selectedAdminUser.games || []).map((g) => (
                          <div
                            key={g.key}
                            className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{g.icon}</span>
                              <div>
                                <p className="font-semibold text-sm">
                                  {g.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {g.key}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                toggleGameAccess(
                                  selectedAdminUser._id,
                                  g.key,
                                  g.hasAccess || false,
                                )
                              }
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                g.hasAccess
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              }`}
                            >
                              {g.hasAccess ? "✅ Cho phép" : "🔒 Khoá"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Info rows */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
                        <p className="text-xs text-slate-500 mb-1">
                          ID MongoDB
                        </p>
                        <p className="text-xs font-mono text-slate-300 truncate">
                          {selectedAdminUser._id}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Ngày đăng ký
                        </p>
                        <p className="text-sm font-semibold text-slate-300">
                          {selectedAdminUser.createdAt
                            ? new Date(
                                selectedAdminUser.createdAt,
                              ).toLocaleDateString("vi-VN")
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Game Modal (iframe) ── */}
      {openGame && (
        <GameModal game={openGame} onClose={() => setOpenGame(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const gradients: Record<string, string> = {
    car_race: "from-orange-500/20 to-red-500/20",
    block_click: "from-cyan-500/20 to-blue-500/20",
    balloon: "from-pink-500/20 to-rose-500/20",
  };

  return (
    <button
      onClick={onClick}
      className="group relative text-left w-full rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#8C46FF]/10 overflow-hidden"
    >
      {/* background gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradients[game.key] || "from-purple-500/20 to-violet-500/20"} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      <div className="relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
          {game.icon}
        </div>
        <h3 className="text-xl font-bold mb-2">{game.name}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          {game.description || "Game TikTok Live tương tác"}
        </p>

        <div className="flex items-center gap-2 mt-4 text-[#8C46FF] font-semibold text-sm group-hover:gap-3 transition-all">
          <span>Mở Game</span>
          <span>→</span>
        </div>
      </div>
    </button>
  );
}

function GameModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const src = "/"; // Fallback, iframe is deprecated

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-[1400px] max-h-[90vh] m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col bg-[#0a0a14]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.03] flex-shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            <span className="text-xl">{game.icon}</span>
            {game.name}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>
        {/* iframe */}
        <iframe
          src={src}
          className="flex-1 w-full border-0"
          title={game.name}
          allow="autoplay"
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-500 mb-0.5">
        {icon} {label}
      </p>
      <p className="text-sm font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}
