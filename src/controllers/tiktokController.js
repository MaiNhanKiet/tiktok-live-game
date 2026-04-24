const tiktokService = require("../services/tiktokService");
const catchAsync = require("../utils/catchAsync");

exports.startSession = catchAsync(async (req, res, next) => {
  const { tiktokUsername } = req.body;
  if (!tiktokUsername) {
    return res.status(400).json({ error: "Missing tiktokUsername" });
  }

  console.log(`[Yêu cầu] Đang theo dõi kênh: ${tiktokUsername}`);

  const result = await tiktokService.connectToTikTokLive(tiktokUsername);
  res.json({ message: "Kết nối thành công", data: result });
});

exports.stopSession = catchAsync(async (req, res, next) => {
  const success = tiktokService.disconnectTikTokLive();
  if (success) {
    console.log("[Yêu cầu] Đã ngắt kết nối kênh hiện hành.");
    res.json({ message: "Đã ngắt kết nối thành công" });
  } else {
    res.status(400).json({ error: "Không có kênh nào đang kết nối" });
  }
});
