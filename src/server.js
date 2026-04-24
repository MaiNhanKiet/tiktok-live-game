const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const tiktokRoutes = require("./routes/tiktokRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const gameRoutes = require("./routes/gameRoutes");
const errorHandler = require("./middlewares/errorHandler");
const socketService = require("./services/socketService");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

// Connect to MongoDB được thực hiện bên dưới qua mongoose.connect()

app.use(cors());
app.use(express.json());

// Redirect root to auth.html
app.get("/", (req, res) => {
  res.redirect("/auth.html");
});

// Serve static files from root directory
// app.use(express.static(path.join(__dirname, "..")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", tiktokRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/games", gameRoutes); // Per-game endpoints (public)

// Error Middleware
app.use(errorHandler);

// Serve static game display pages (index.html, racing.html — public, no auth)
const path = require("path");
app.use(express.static(path.join(__dirname, "..")));

// Init HTTP server
const server = http.createServer(app);

// Connect DB
const MONGO_URI = process.env.MONGO_URI;
console.log(MONGO_URI);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Kết nối MongoDB thành công"))
  .catch((err) => console.error("Lỗi kết nối DB:", err));

// Init Socket.io
socketService.init(server);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log("Vui lòng mở file index.html trên trình duyệt để sử dụng.");
});
