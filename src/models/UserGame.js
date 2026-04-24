const mongoose = require("mongoose");

// UserGame: lưu quyền truy cập game của từng user
const userGameSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gameKey: {
      type: String,
      required: true, // "car_race" | "block_click"
    },
    hasAccess: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Đảm bảo mỗi cặp userId - gameKey là duy nhất
userGameSchema.index({ userId: 1, gameKey: 1 }, { unique: true });

module.exports = mongoose.model("UserGame", userGameSchema);
