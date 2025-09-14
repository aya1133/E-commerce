




const express = require("express");
const userRouter = require('./routers/user.router');
const productRoutes = require("./routers/product.router");
const bannerRoutes = require("./routers/banner.router");
const categoriesRoutes = require('./routers/categories.router');
const ratingRoutes = require("./routers/rating.router");
const voucherRoutes = require("./routers/voucher.router");
const ordersRoutes = require("./routers/orders.router");
const imagesRoutes = require("./routers/images.router");


const router = express.Router();
router.use('/users',userRouter);
router.use("/product", productRoutes);
router.use('/banner',bannerRoutes);
router.use('/categories',categoriesRoutes);
router.use('/rating',ratingRoutes);
router.use('/voucher',voucherRoutes);
router.use('/orders',ordersRoutes);
router.use('/images',imagesRoutes);
module.exports = router;