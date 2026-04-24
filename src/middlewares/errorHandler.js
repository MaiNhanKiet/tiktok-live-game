const errorHandler = (err, req, res, next) => {
  console.error("[Lỗi Hệ Thống]:", err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Không thể kết nối hoặc đã xảy ra lỗi.",
  });
};

module.exports = errorHandler;
