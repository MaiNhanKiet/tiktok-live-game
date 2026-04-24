const User = require("../models/User");
const UserGame = require("../models/UserGame");
const bcrypt = require("bcryptjs");
const catchAsync = require("../utils/catchAsync");

// Danh sách các game được hỗ trợ (dùng như nguồn sự thật)
const SUPPORTED_GAMES = [
  {
    key: "car_race",
    name: "Đua Xe",
    description: "Game đua xe TikTok Live",
    icon: "🏎️",
  },
  {
    key: "block_click",
    name: "Click Khối",
    description: "Game click khối màu theo Like/Gift",
    icon: "🧱",
  },
  {
    key: "balloon",
    name: "Bong Bóng Nước",
    description: "Bơm bóng qua comment/like/quà — nổ là game over!",
    icon: "🎈",
  },
];

// GET /api/admin/users  — Lấy toàn bộ users kèm game access
exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find({}, "-password").lean();

  // Lấy toàn bộ userGame records (tránh N+1)
  const allUserGames = await UserGame.find({}).lean();

  const usersWithGames = users.map((u) => {
    const games = SUPPORTED_GAMES.map((g) => {
      const record = allUserGames.find(
        (ug) =>
          ug.userId.toString() === u._id.toString() && ug.gameKey === g.key
      );
      return {
        ...g,
        hasAccess: record ? record.hasAccess : false,
      };
    });
    return { ...u, games };
  });

  res.json({ users: usersWithGames });
});

// PUT /api/admin/users/:userId/games/:gameKey  — Toggle game access
exports.setGameAccess = catchAsync(async (req, res) => {
  const { userId, gameKey } = req.params;
  const { hasAccess } = req.body;

  if (!SUPPORTED_GAMES.find((g) => g.key === gameKey)) {
    return res.status(400).json({ message: "Game không hợp lệ" });
  }

  const updated = await UserGame.findOneAndUpdate(
    { userId, gameKey },
    { hasAccess: !!hasAccess },
    { upsert: true, new: true }
  );

  res.json({ message: "Cập nhật quyền game thành công", data: updated });
});

// GET /api/admin/games  — Danh sách game được hỗ trợ
exports.getGames = catchAsync(async (req, res) => {
  res.json({ games: SUPPORTED_GAMES });
});

// DELETE /api/admin/users/:userId  — Xóa user
exports.deleteUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  await User.findByIdAndDelete(userId);
  await UserGame.deleteMany({ userId });
  res.json({ message: "Đã xóa người dùng" });
});

// GET /api/admin/users/:userId  — Chi tiết 1 user (kèm game access)
exports.getUserDetail = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId, "-password").lean();
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  const userGames = await UserGame.find({ userId }).lean();
  const games = SUPPORTED_GAMES.map((g) => {
    const record = userGames.find((ug) => ug.gameKey === g.key);
    return { ...g, hasAccess: record ? record.hasAccess : false };
  });

  res.json({ user: { ...user, games } });
});
