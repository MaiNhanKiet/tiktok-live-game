const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/auth");

// Tất cả routes yêu cầu token
router.use(verifyToken);

router.get("/me", userController.getMe);
router.put("/me", userController.updateMe);
router.get("/me/games", userController.getMyGames);

module.exports = router;
