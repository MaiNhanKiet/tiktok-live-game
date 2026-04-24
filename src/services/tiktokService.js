const { TikTokLiveConnection, SignConfig } = require("tiktok-live-connector");
const GameState = require("../models/GameState");
const socketService = require("./socketService");

SignConfig.apiKey =
  "euler_M2I5YTA0ZjViOWIyMjA3YTY0MTJiODE4NTI4OWI5MDk3NThiZTQ5MWRiYjljMmFjOGRiOGJl";

function checkAndMoveRacers(eventType, eventData) {
  const io = socketService.getIo();
  const currentRaceConfig = GameState.getRaceConfig();
  if (!currentRaceConfig) return;

  const { lanes } = currentRaceConfig;
  lanes.forEach((lane) => {
    let triggered = false;
    let computedSteps = 0;

    if (eventType === "chat" && lane.flag) {
      if (eventData.comment && eventData.comment.includes(lane.flag)) {
        triggered = true;
        computedSteps = 1;
      }
    }
    if (eventType === "gift" && lane.gift) {
      if (
        eventData.giftName &&
        eventData.giftName.toLowerCase().includes(lane.gift.toLowerCase())
      ) {
        triggered = true;
        computedSteps = (eventData.amount || 1) * 5;
      }
    }

    if (triggered && computedSteps > 0) {
      // Bắn sự kiện move tương ứng với lane ID
      io.emit("racer-move", {
        id: lane.id,
        steps: computedSteps,
      });
    }
  });
}

async function connectToTikTokLive(tiktokUsername) {
  let conn = GameState.getTiktokConnection();
  if (conn) {
    conn.disconnect();
    GameState.setTiktokConnection(null);
  }

  conn = new TikTokLiveConnection(tiktokUsername);
  GameState.setTiktokConnection(conn);

  try {
    const state = await conn.connect();
    const connectedId = state?.roomInfo?.data?.owner_user_id || tiktokUsername;
    console.log(`[Thành công] Đã kết nối với livestream của: ${connectedId}`);

    const io = socketService.getIo();

    conn.on("gift", (data) => {
      const username =
        data.uniqueId ||
        data.user?.uniqueId ||
        data.user?.userId ||
        "Người dùng ẩn danh";
      const giftName =
        data.giftName ||
        data.gift?.name ||
        data.common?.describe?.split(" ")?.pop() ||
        "Quà tặng";
      const repeatCount = data.repeatCount || 1;
      const profilePicture =
        data.profilePictureUrl ||
        data.user?.profilePicture?.url?.[0] ||
        "https://via.placeholder.com/50";
      const diamondCount = data.diamondCount || 1;

      let giftPictureUrl = "";
      const mUri =
        data.giftDetails?.giftImage?.mUri || data.giftDetails?.icon?.mUri;
      if (mUri) {
        giftPictureUrl = `https://p16-webcast.tiktokcdn.com/img/maliva/${mUri}~tplv-obj.png`;
      } else {
        giftPictureUrl =
          data.giftPictureUrl ||
          data.giftDetails?.giftImage?.url?.[0] ||
          data.gift?.icon?.url_list?.[0] ||
          "";
      }

      console.log(
        `[Quà tặng] ${username} đã tặng ${giftName} | Link hình: ${giftPictureUrl}`,
      );

      io.emit("tiktok-gift", {
        username: username,
        giftName: giftName,
        amount: repeatCount,
        diamonds: diamondCount,
        profilePicture: profilePicture,
        giftPictureUrl: giftPictureUrl,
      });

      checkAndMoveRacers("gift", { giftName: giftName, amount: repeatCount });
    });

    conn.on("like", (data) => {
      const username =
        data.uniqueId || data.user?.uniqueId || "Người dùng ẩn danh";
      const likeCount = data.likeCount || 1;
      const profilePicture =
        data.profilePictureUrl ||
        data.user?.profilePicture?.url?.[0] ||
        "https://via.placeholder.com/50";

      console.log(`[Like] ${username} đã thả ${likeCount} tim`);

      io.emit("tiktok-like", {
        username: username,
        amount: likeCount,
        profilePicture: profilePicture,
      });
    });

    conn.on("chat", (data) => {
      const username =
        data.uniqueId || data.user?.uniqueId || "Người dùng ẩn danh";
      const comment = data.comment || "";
      const profilePicture =
        data.profilePictureUrl ||
        data.user?.profilePicture?.url?.[0] ||
        "https://via.placeholder.com/50";
        
      console.log(`[Chat] ${username}: ${comment}`);

      io.emit("tiktok-chat", {
        username: username,
        comment: comment,
        profilePicture: profilePicture,
      });

      checkAndMoveRacers("chat", { comment: comment });
    });

    conn.on("disconnected", () => {
      console.log(`[Đã ngắt] Mất kết nối tới: ${connectedId}`);
      io.emit("tiktok-disconnected");
    });

    return { success: true, connectedId };
  } catch (err) {
    console.error(
      `[Lỗi] Không thể kết nối tới kênh ${tiktokUsername}:`,
      err.message || err,
    );
    throw err;
  }
}

function disconnectTikTokLive() {
  const conn = GameState.getTiktokConnection();
  if (conn) {
    conn.disconnect();
    GameState.setTiktokConnection(null);
    return true;
  }
  return false;
}

module.exports = {
  connectToTikTokLive,
  disconnectTikTokLive,
  checkAndMoveRacers,
};
