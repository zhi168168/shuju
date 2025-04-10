const mongoose = require('mongoose');

async function verifyDatabase() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect('mongodb://localhost:27017/xiaohongshu-monitor', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');
    
    // 查询所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('数据库中的集合:', collections.map(c => c.name));
    
    // 查询products集合中的文档数量
    const productsCount = await mongoose.connection.db.collection('products').countDocuments();
    console.log('products集合中的文档数量:', productsCount);
    
    // 获取一个样本文档
    if (productsCount > 0) {
      const sampleProduct = await mongoose.connection.db.collection('products').findOne();
      console.log('样本文档:', JSON.stringify(sampleProduct, null, 2));
    }
    
    // 定义产品模型
    const productSchema = new mongoose.Schema({
      url: String,
      name: String,
      price: Number,
      sales: Number,
      shopName: String,
      shopSales: Number,
      lastUpdated: Date,
      dailyProductSales: Number,
      dailyShopSales: Number,
      dailyGMV: Number,
      dailyData: Array
    });
    
    // 注册模型
    const Product = mongoose.model('Product', productSchema);
    
    // 通过模型查询
    console.log('通过mongoose模型查询...');
    const products = await Product.find();
    console.log(`mongoose模型查询到 ${products.length} 个商品`);
    
    if (products.length > 0) {
      console.log('第一个商品:', products[0].name);
    }
    
    mongoose.connection.close();
    console.log('数据库连接已关闭');
    
  } catch (error) {
    console.error('验证数据库时出错:', error);
  }
}

verifyDatabase(); 