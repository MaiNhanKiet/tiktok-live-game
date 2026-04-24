const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

exports.register = catchAsync(async (req, res, next) => {
  const { username, password, tiktokId } = req.body;

  if (!username || !password || !tiktokId) {
    return res.status(400).json({
      message: "Vui lòng nhập đầy đủ Tên đăng nhập, Mật khẩu và TikTok ID.",
    });
  }

  // Check exist
  const existUser = await User.findOne({ username });
  if (existUser) {
    return res.status(400).json({ message: "Tài khoản đã tồn tại" });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Mặc định luôn là role user
  const newUser = new User({
    username,
    password: hashedPassword,
    tiktokId: tiktokId || "",
    role: "user",
  });

  await newUser.save();
  res.status(201).json({ message: "Đăng kí thành công" });
});

exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user) {
    return res
      .status(401)
      .json({ message: "Tài khoản hoặc mật khẩu không đúng" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ message: "Tài khoản hoặc mật khẩu không đúng" });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({
    message: "Đăng nhập thành công",
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      tiktokId: user.tiktokId,
    },
  });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { password, tiktokId } = req.body;

  // Cần có token/middleware check thực tế, ở đây làm logic query:
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy user" });
  }

  if (password) {
    user.password = await bcrypt.hash(password, 10);
  }

  if (tiktokId !== undefined) {
    user.tiktokId = tiktokId;
  }

  await user.save();
  res.json({ message: "Cập nhật thành công", user });
});
