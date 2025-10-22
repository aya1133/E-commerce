const express = require("express");

// Routers
const adminRouter = require("./routers/admin.router");
const userRouter = require("./routers/user.router");
const productRoutes = require("./routers/product.router");
const bannerRoutes = require("./routers/banner.router");
const categoriesRoutes = require("./routers/categories.router");
const ratingRoutes = require("./routers/rating.router");
const voucherRoutes = require("./routers/voucher.router");
const ordersRoutes = require("./routers/orders.router");
const imagesRoutes = require("./routers/images.router");
const upload = require("./routers/upload");

const router = express.Router();

router.use("/users", userRouter); // User routes
router.use("/admin", adminRouter); // Admin routes
router.use("/product", productRoutes);
router.use("/banner", bannerRoutes);
router.use("/categories", categoriesRoutes);
router.use("/rating", ratingRoutes);
router.use("/voucher", voucherRoutes);
router.use("/orders", ordersRoutes);
router.use("/images", imagesRoutes);
router.use("/upload", upload);

module.exports = router;
