const mongoose = require('mongoose');

const dailyDataSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  productSales: { type: Number, required: true },
  shopSales: { type: Number, required: true },
  price: { type: Number, required: true }
});

const productSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  sales: { type: Number, required: true },
  shopName: { type: String, required: true },
  shopSales: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  dailyData: [dailyDataSchema],
  dailyProductSales: { type: Number, default: 0 },
  dailyShopSales: { type: Number, default: 0 },
  dailyGMV: { type: Number, default: 0 }
});

module.exports = mongoose.model('Product', productSchema); 