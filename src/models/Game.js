const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true, // e.g. "car_race", "block_click"
    },
    name: {
      type: String,
      required: true, // e.g. "Đua Xe", "Click Khối"
    },
    description: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "🎮",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
