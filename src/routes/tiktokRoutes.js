const express = require("express");
const tiktokController = require("../controllers/tiktokController");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();

router.post("/start-session", catchAsync(tiktokController.startSession));
router.post("/stop-session", catchAsync(tiktokController.stopSession));

module.exports = router;
