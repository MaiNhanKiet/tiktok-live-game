const { Server } = require("socket.io");
const GameState = require("../models/GameState");

let io;

module.exports = {
  init: (server) => {
    io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
      console.log(`[Socket] Kết nối: ${socket.id}`);

      // Client join room (roomId = `${gameKey}:${tiktokId}`)
      socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`[Socket] ${socket.id} joined room: ${roomId}`);
      });

      // Car Race — emit về đúng room
      socket.on("setup-race", ({ roomId, ...config }) => {
        GameState.setRaceConfig(config);
        if (roomId) io.to(roomId).emit("start-game", config);
        else io.emit("start-game", config);
      });

      // Racer move — từ display page, broadcast về room
      socket.on("racer-move", ({ roomId, id, steps }) => {
        if (roomId) io.to(roomId).emit("racer-move", { id, steps });
        else io.emit("racer-move", { id, steps });
      });

      // Block Click
      socket.on("setup-block-click", ({ roomId, ...config }) => {
        if (roomId) io.to(roomId).emit("setup-block-click", config);
        else io.emit("setup-block-click", config);
      });

      // Balloon
      socket.on("setup-balloon", ({ roomId, ...config }) => {
        if (roomId) io.to(roomId).emit("setup-balloon", config);
        else io.emit("setup-balloon", config);
      });

      socket.on("balloon-reset", (payload) => {
        const roomId = payload?.roomId;
        if (roomId) io.to(roomId).emit("balloon-reset");
        else io.emit("balloon-reset");
      });

      socket.on("balloon-deflate", (payload) => {
        const roomId = payload?.roomId;
        if (roomId) io.to(roomId).emit("balloon-deflate");
        else io.emit("balloon-deflate");
      });

      socket.on("disconnect", () => {
        console.log(`[Socket] Ngắt kết nối: ${socket.id}`);
      });
    });

    return io;
  },
  getIo: () => {
    if (!io) throw new Error("Socket.io chưa được khởi tạo!");
    return io;
  },
};
