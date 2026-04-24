const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyToken, requireAdmin } = require("../middlewares/auth");

// Tất cả routes phía dưới yêu cầu token + quyền admin
router.use(verifyToken, requireAdmin);

// Quản lý users
router.get("/users", adminController.getAllUsers);
router.get("/users/:userId", adminController.getUserDetail);
router.delete("/users/:userId", adminController.deleteUser);

// Quản lý game access
router.put("/users/:userId/games/:gameKey", adminController.setGameAccess);

// Danh sách games
router.get("/games", adminController.getGames);

module.exports = router;
