const mongoose = require('mongoose');
const Product = require('../models/product');
const crawlerService = require('../services/crawler');
const moment = require('moment');
const { validationResult } = require('express-validator');

// 主页 - 显示所有商品
exports.getProducts = async (req, res) => {
  try {
    console.log('开始获取商品列表...');
    const sortField = req.query.sort || 'lastUpdated';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    console.log(`查询参数: sortField=${sortField}, sortOrder=${sortOrder}`);
    
    // 执行查询
    console.log('开始执行数据库查询...');
    console.log('应用排序选项:', sortOptions);
    let products = await Product.find().sort(sortOptions).lean().exec();
    
    // 确保products是数组
    if (!Array.isArray(products)) {
      console.log('查询结果不是数组，转换为数组');
      products = products ? [products] : [];
    }
    
    console.log(`查询到 ${products.length} 个商品`);
    
    if (products.length > 0) {
      console.log('第一个商品样例:', JSON.stringify(products[0]));
    } else {
      console.log('没有查询到商品数据');
      
      // 尝试直接从MongoDB获取数据
      console.log('尝试直接从MongoDB获取数据...');
      const rawProducts = await mongoose.connection.db.collection('products').find({}).toArray();
      console.log(`直接从MongoDB获取到 ${rawProducts.length} 个商品`);
      
      if (rawProducts.length > 0) {
        products = rawProducts;
      }
    }
    
    console.log('准备渲染页面...');
    res.render('index', { 
      products: products || [],
      moment,
      currentSort: sortField,
      currentOrder: req.query.order || 'desc'
    });
    console.log('页面渲染完成');
  } catch (error) {
    console.error('获取商品列表失败:', error);
    console.error('错误堆栈:', error.stack);
    
    // 出错时也尝试渲染页面，但使用空数组
    try {
      res.render('index', { 
        products: [],
        moment,
        currentSort: 'lastUpdated',
        currentOrder: 'desc',
        error: error.message
      });
    } catch (renderError) {
      res.status(500).send('获取商品列表失败: ' + error.message);
    }
  }
};

// 添加新商品
exports.addProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    
    const { url } = req.body;
    
    if (!url.includes('xiaohongshu.com')) {
      return res.status(400).json({ success: false, message: '请输入有效的小红书商品链接' });
    }
    
    // 设置爬取状态为进行中
    global.crawlingStatus = {
      isActive: true,
      current: 1,
      total: 1,
      product: url
    };
    
    const result = await crawlerService.crawlAndAddProduct(url);
    
    // 重置爬取状态
    global.crawlingStatus = { isActive: false };
    
    if (result.success) {
      return res.status(201).json({ success: true, product: result.product });
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    // 重置爬取状态
    global.crawlingStatus = { isActive: false };
    
    console.error('添加商品失败:', error);
    res.status(500).json({ success: false, message: '添加商品失败: ' + error.message });
  }
};

// 批量添加商品
exports.batchAddProducts = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ success: false, message: '请提供有效的URL数组' });
    }
    
    // 验证每个URL
    for (const url of urls) {
      if (!url.includes('xiaohongshu.com')) {
        return res.status(400).json({ success: false, message: `无效的小红书链接: ${url}` });
      }
    }
    
    console.log(`开始批量添加 ${urls.length} 个商品`);
    
    // 设置爬取状态为进行中
    global.crawlingStatus = {
      isActive: true,
      current: 0,
      total: urls.length
    };
    
    let successCount = 0;
    let failCount = 0;
    let results = [];
    
    // 串行爬取每个商品
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      try {
        console.log(`正在爬取 (${i+1}/${urls.length}): ${url}`);
        
        // 更新当前进度
        global.crawlingStatus.current = i + 1;
        global.crawlingStatus.product = url;
        
        const result = await crawlerService.crawlAndAddProduct(url);
        
        if (result.success) {
          successCount++;
          results.push({ url, success: true, product: result.product });
        } else {
          failCount++;
          results.push({ url, success: false, message: result.message });
        }
      } catch (error) {
        console.error(`商品爬取失败 (${url}):`, error);
        failCount++;
        results.push({ url, success: false, message: error.message });
      }
      
      // 如果不是最后一个URL，添加延迟，避免频繁请求
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      }
    }
    
    // 重置爬取状态
    global.crawlingStatus = { isActive: false };
    
    console.log(`批量添加完成。成功: ${successCount}, 失败: ${failCount}`);
    
    return res.status(200).json({
      success: true,
      successCount,
      failCount,
      results
    });
    
  } catch (error) {
    // 重置爬取状态
    global.crawlingStatus = { isActive: false };
    
    console.error('批量添加商品失败:', error);
    res.status(500).json({ success: false, message: '批量添加商品失败: ' + error.message });
  }
};

// 删除商品
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('接收到删除请求，商品ID:', productId);
    
    // 先检查产品是否存在
    const product = await Product.findById(productId);
    if (!product) {
      console.error('商品不存在，ID:', productId);
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    
    console.log('商品存在，准备删除:', product.name);
    
    // 删除商品
    const result = await Product.findByIdAndDelete(productId);
    console.log('删除结果:', result ? '成功' : '失败');
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('删除商品失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '删除商品失败: ' + error.message });
  }
};

// 获取商品历史数据（用于下载）
exports.getProductHistory = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    
    // 构建CSV数据
    let csvContent = '日期,商品名称,商品URL,价格,商品销量,店铺销量\n';
    
    product.dailyData.forEach(data => {
      const date = moment(data.date).format('YYYY-MM-DD');
      csvContent += `${date},${product.name},${product.url},${data.price},${data.productSales},${data.shopSales}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(product.name)}-历史数据.csv`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('获取商品历史数据失败:', error);
    res.status(500).json({ success: false, message: '获取商品历史数据失败: ' + error.message });
  }
};

// 获取爬取状态
exports.getCrawlingStatus = async (req, res) => {
  res.json(global.crawlingStatus || { isActive: false });
};

// 手动触发全部爬取
exports.triggerCrawl = async (req, res) => {
  try {
    // 检查是否已经在爬取中
    if (global.crawlingStatus && global.crawlingStatus.isActive) {
      return res.status(400).json({ success: false, message: '爬取任务已在进行中' });
    }
    
    // 设置爬取状态
    const products = await Product.find();
    global.crawlingStatus = {
      isActive: true,
      current: 0,
      total: products.length
    };
    
    // 异步启动爬取
    crawlerService.crawlAllProducts()
      .then(result => {
        console.log('手动爬取完成:', result);
        global.crawlingStatus = { isActive: false };
      })
      .catch(err => {
        console.error('手动爬取失败:', err);
        global.crawlingStatus = { isActive: false };
      });
    
    res.json({ success: true, message: '爬取任务已启动' });
  } catch (error) {
    global.crawlingStatus = { isActive: false };
    console.error('启动爬取任务失败:', error);
    res.status(500).json({ success: false, message: '启动爬取任务失败: ' + error.message });
  }
}; 