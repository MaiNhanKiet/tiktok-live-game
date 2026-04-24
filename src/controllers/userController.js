const User = require("../models/User");
const UserGame = require("../models/UserGame");
const bcrypt = require("bcryptjs");
const catchAsync = require("../utils/catchAsync");

// Danh sách game được hỗ trợ
const SUPPORTED_GAMES = [
  { key: "car_race", name: "Đua Xe", icon: "🏎️" },
  { key: "block_click", name: "Click Khối", icon: "🧱" },
  { key: "balloon", name: "Bong Bóng Nước", icon: "🎈" },
];

// GET /api/user/me/games  — Lấy danh sách game mà user hiện tại có quyền
exports.getMyGames = catchAsync(async (req, res) => {
  const userId = req.user.id; // từ verifyToken middleware
  const userGames = await UserGame.find({ userId, hasAccess: true }).lean();

  const accessibleGames = SUPPORTED_GAMES.filter((g) =>
    userGames.find((ug) => ug.gameKey === g.key),
  );

  res.json({ games: accessibleGames });
});

// GET /api/user/me  — Lấy profile đầy đủ
exports.getMe = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId, "-password").lean();
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  const userGames = await UserGame.find({ userId, hasAccess: true }).lean();
  const accessibleGames = SUPPORTED_GAMES.filter((g) =>
    userGames.find((ug) => ug.gameKey === g.key),
  );

  res.json({ user: { ...user, games: accessibleGames } });
});

// PUT /api/user/me  — Cập nhật password / tiktokId
exports.updateMe = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { password, tiktokId } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  if (password && password.trim()) {
    user.password = await bcrypt.hash(password, 10);
  }

  if (tiktokId !== undefined) {
    user.tiktokId = tiktokId;
  }

  await user.save();

  const updated = user.toObject();
  delete updated.password;

  res.json({ message: "Cập nhật thành công", user: updated });
});
