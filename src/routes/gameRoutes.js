/**
 * gameRoutes.js
 * Endpoint riêng cho từng game. Không yêu cầu đăng nhập —
 * token tùy chọn, dùng để lấy TikTok ID từ profile.
 *
 * POST /api/games/:gameKey/start-session   { tiktokUsername }
 * POST /api/games/:gameKey/stop-session
 * GET  /api/games/:gameKey/status
 */

const express = require("express");
const router = express.Router();
const gameSessionService = require("../services/gameSessionService");
const catchAsync = require("../utils/catchAsync");

const ALLOWED_GAMES = ["block_click", "car_race", "balloon"];

// ── Start session ──────────────────────────────────────────────────────────────
router.post(
  "/:gameKey/start-session",
  catchAsync(async (req, res) => {
    const { gameKey } = req.params;
    if (!ALLOWED_GAMES.includes(gameKey)) {
      return res.status(404).json({ error: "Game không tồn tại" });
    }

    const { tiktokUsername } = req.body;
    if (!tiktokUsername || !tiktokUsername.trim()) {
      return res.status(400).json({ error: "Thiếu tiktokUsername" });
    }

    const result = await gameSessionService.connectGame(
      gameKey,
      tiktokUsername.trim()
    );
    res.json({ message: "Kết nối thành công", data: result });
  })
);

// ── Stop session ───────────────────────────────────────────────────────────────
router.post(
  "/:gameKey/stop-session",
  catchAsync(async (req, res) => {
    const { gameKey } = req.params;
    const { tiktokUsername } = req.body;
    
    if (!tiktokUsername) {
      return res.status(400).json({ error: "Thiếu tiktokUsername" });
    }

    const ok = gameSessionService.disconnectGame(gameKey, tiktokUsername.trim());
    if (ok) {
      res.json({ message: "Đã ngắt kết nối" });
    } else {
      res.status(400).json({ error: "Không có session nào đang chạy" });
    }
  })
);

// ── Status ─────────────────────────────────────────────────────────────────────
router.get(
  "/:gameKey/status",
  catchAsync(async (req, res) => {
    const { gameKey } = req.params;
    const { tiktokUsername } = req.query;
    
    if (!tiktokUsername) {
      return res.status(400).json({ error: "Thiếu tiktokUsername" });
    }

    res.json({ connected: gameSessionService.isConnected(gameKey, tiktokUsername.trim()), gameKey });
  })
);

module.exports = router;
