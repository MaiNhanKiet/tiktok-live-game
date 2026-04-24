/**
 * gameSessionService.js — Room-based TikTok connections
 * sessions[roomId] = connection, roomId = `${gameKey}:${tiktokId}`
 */
const { TikTokLiveConnection, SignConfig } = require("tiktok-live-connector");
const socketService = require("./socketService");
const dotenv = require("dotenv");
dotenv.config();

SignConfig.apiKey =
  "euler_M2I5YTA0ZjViOWIyMjA3YTY0MTJiODE4NTI4OWI5MDk3NThiZTQ5MWRiYjljMmFjOGRiOGJl";

// sessions[roomId] = TikTokLiveConnection
const sessions = {};

async function connectGame(gameKey, tiktokUsername) {
  const roomId = `${gameKey}:${tiktokUsername}`;

  // Ngắt kết nối cũ nếu còn
  if (sessions[roomId]) {
    try { sessions[roomId].disconnect(); } catch (_) {}
    delete sessions[roomId];
  }

  const conn = new TikTokLiveConnection(tiktokUsername);
  sessions[roomId] = conn;

  const state = await conn.connect();
  const connectedId = state?.roomInfo?.data?.owner_user_id || tiktokUsername;
  console.log(`[${gameKey}][${tiktokUsername}] Đã kết nối: ${connectedId}`);

  const io = socketService.getIo();

  conn.on("gift", (data) => {
    const username = data.uniqueId || data.user?.uniqueId || "Ẩn danh";
    const giftName = data.giftName || data.gift?.name || "Quà tặng";
    const repeatCount = data.repeatCount || 1;
    const profilePicture = data.profilePictureUrl || data.user?.profilePicture?.url?.[0] || "";
    const diamondCount = data.diamondCount || 1;

    let giftPictureUrl = "";
    const mUri = data.giftDetails?.giftImage?.mUri || data.giftDetails?.icon?.mUri;
    if (mUri) {
      giftPictureUrl = `https://p16-webcast.tiktokcdn.com/img/maliva/${mUri}~tplv-obj.png`;
    } else {
      giftPictureUrl = data.giftPictureUrl || data.giftDetails?.giftImage?.url?.[0] || "";
    }

    console.log(`[${gameKey}][${tiktokUsername}][Gift] ${username} → ${giftName} x${repeatCount}`);
    io.to(roomId).emit(`game:${gameKey}:gift`, {
      username, giftName, amount: repeatCount,
      diamonds: diamondCount, profilePicture, giftPictureUrl,
    });
  });

  conn.on("like", (data) => {
    const username = data.uniqueId || data.user?.uniqueId || "Ẩn danh";
    const likeCount = data.likeCount || 1;
    const profilePicture = data.profilePictureUrl || data.user?.profilePicture?.url?.[0] || "";
    console.log(`[${gameKey}][${tiktokUsername}][Like] ${username} x${likeCount}`);
    io.to(roomId).emit(`game:${gameKey}:like`, { username, amount: likeCount, profilePicture });
  });

  conn.on("chat", (data) => {
    const username = data.uniqueId || data.user?.uniqueId || "Ẩn danh";
    const comment = data.comment || "";
    console.log(`[${gameKey}][${tiktokUsername}][Chat] ${username}: ${comment}`);
    io.to(roomId).emit(`game:${gameKey}:chat`, { username, comment });
  });

  conn.on("disconnected", () => {
    console.log(`[${gameKey}][${tiktokUsername}] Mất kết nối TikTok`);
    io.to(roomId).emit(`game:${gameKey}:disconnected`);
    delete sessions[roomId];
  });

  return { success: true, connectedId, gameKey, roomId };
}

function disconnectGame(gameKey, tiktokUsername) {
  const roomId = `${gameKey}:${tiktokUsername}`;
  if (sessions[roomId]) {
    try { sessions[roomId].disconnect(); } catch (_) {}
    delete sessions[roomId];
    return true;
  }
  return false;
}

function isConnected(gameKey, tiktokUsername) {
  const roomId = `${gameKey}:${tiktokUsername}`;
  return !!sessions[roomId];
}

module.exports = { connectGame, disconnectGame, isConnected };
