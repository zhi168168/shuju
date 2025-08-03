const mongoose = require('mongoose');
const Product = require('../models/Product');
const crawlerService = require('../services/crawler');
const moment = require('moment');
const { validationResult } = require('express-validator');

// 主页 - 显示所有商品
exports.getProducts = async (req, res) => {
  try {
    console.log('开始获取商品列表...');
    const sortField = req.query.sort || 'lastUpdated';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const showFavorites = req.query.favorites === 'true';
    
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // 构建查询条件
    const queryOptions = {};
    if (showFavorites) {
      queryOptions.isFavorite = true;
    }
    
    console.log(`查询参数: sortField=${sortField}, sortOrder=${sortOrder}, showFavorites=${showFavorites}`);
    
    // 执行查询
    console.log('开始执行数据库查询...');
    console.log('应用排序选项:', sortOptions);
    console.log('查询条件:', queryOptions);
    let products = await Product.find(queryOptions).sort(sortOptions).lean().exec();
    
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
      currentOrder: req.query.order || 'desc',
      showFavorites: showFavorites
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
        showFavorites: false,
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
      total: urls.length,
      successCount: 0,
      failCount: 0,
      processing: []
    };
    
    // 立即返回响应，让前端开始轮询
    res.status(200).json({
      success: true,
      message: '批量添加任务已启动',
      total: urls.length
    });
    
    // 异步处理批量添加
    processBatchUrls(urls);
    
  } catch (error) {
    console.error('启动批量添加任务失败:', error);
    res.status(500).json({ success: false, message: '启动批量添加任务失败: ' + error.message });
  }
};

// 异步处理批量URL的函数
async function processBatchUrls(urls) {
  let successCount = 0;
  let failCount = 0;
  let results = [];
  
  try {
    // 并行爬取商品，最多2个并发
    const concurrency = 2;
    const processedUrls = [];
    
    // 处理单个URL的函数
    const processUrl = async (url, index) => {
      try {
        console.log(`开始爬取 (${index+1}/${urls.length}): ${url}`);
        
        // 更新正在处理的商品列表
        global.crawlingStatus.processing.push(url);
        
        const result = await crawlerService.crawlAndAddProduct(url);
        
        // 从正在处理列表中移除
        const processingIndex = global.crawlingStatus.processing.indexOf(url);
        if (processingIndex > -1) {
          global.crawlingStatus.processing.splice(processingIndex, 1);
        }
        
        if (result.success) {
          successCount++;
          global.crawlingStatus.successCount = successCount;
          results.push({ url, success: true, product: result.product });
          console.log(`爬取成功 (${index+1}/${urls.length}): ${url}`);
        } else {
          failCount++;
          global.crawlingStatus.failCount = failCount;
          results.push({ url, success: false, message: result.message });
          console.log(`爬取失败 (${index+1}/${urls.length}): ${url} - ${result.message}`);
        }
        
        processedUrls.push(url);
        global.crawlingStatus.current = processedUrls.length;
        
        return { url, success: result.success, result };
      } catch (error) {
        // 从正在处理列表中移除
        const processingIndex = global.crawlingStatus.processing.indexOf(url);
        if (processingIndex > -1) {
          global.crawlingStatus.processing.splice(processingIndex, 1);
        }
        
        console.error(`商品爬取失败 (${index+1}/${urls.length}): ${url}`, error);
        failCount++;
        global.crawlingStatus.failCount = failCount;
        results.push({ url, success: false, message: error.message });
        
        processedUrls.push(url);
        global.crawlingStatus.current = processedUrls.length;
        
        return { url, success: false, error };
      }
    };
    
    // 并发处理URLs，每批处理concurrency个
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map((url, batchIndex) => 
        processUrl(url, i + batchIndex)
      );
      
      // 等待当前批次完成
      await Promise.all(batchPromises);
      
      // 如果不是最后一批，添加延迟避免过于频繁的请求
      if (i + concurrency < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      }
    }
    
    console.log(`批量添加完成。成功: ${successCount}, 失败: ${failCount}`);
    
  } catch (error) {
    console.error('批量添加处理失败:', error);
  } finally {
    // 保存最终状态到全局状态中
    global.crawlingStatus = { 
      isActive: false,
      current: urls.length,
      total: urls.length,
      successCount: successCount,
      failCount: failCount,
      processing: []
    };
  }
}

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

// 批量删除商品
exports.batchDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body;
    console.log('接收到批量删除请求，商品IDs:', productIds);
    
    // 验证输入
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的商品' });
    }
    
    // 验证所有ID的格式
    const validIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length !== productIds.length) {
      return res.status(400).json({ success: false, message: '存在无效的商品ID' });
    }
    
    // 检查要删除的商品是否存在
    const existingProducts = await Product.find({ _id: { $in: validIds } });
    console.log(`找到 ${existingProducts.length} 个存在的商品，准备删除`);
    
    if (existingProducts.length === 0) {
      return res.status(404).json({ success: false, message: '未找到要删除的商品' });
    }
    
    // 执行批量删除
    const result = await Product.deleteMany({ _id: { $in: validIds } });
    console.log(`批量删除结果: 删除了 ${result.deletedCount} 个商品`);
    
    res.status(200).json({ 
      success: true, 
      message: `成功删除 ${result.deletedCount} 个商品`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('批量删除商品失败:', error);
    res.status(500).json({ success: false, message: '批量删除失败: ' + error.message });
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

// 切换商品收藏状态
exports.toggleFavorite = async (req, res) => {
  try {
    const productId = req.params.id;
    console.log('切换收藏状态，商品ID:', productId);
    
    // 先获取当前状态
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    
    const newFavoriteStatus = !product.isFavorite;
    
    // 使用findByIdAndUpdate直接更新，避免完整文档验证
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isFavorite: newFavoriteStatus },
      { new: true, runValidators: false } // 不运行完整验证
    );
    
    console.log(`商品 ${product.name} 收藏状态已更新为: ${newFavoriteStatus}`);
    
    res.json({ 
      success: true, 
      isFavorite: newFavoriteStatus,
      message: newFavoriteStatus ? '已添加到收藏' : '已取消收藏'
    });
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.status(500).json({ success: false, message: '操作失败: ' + error.message });
  }
};

// 下载商品Excel数据
exports.downloadProductExcel = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: '商品不存在' });
    }
    
    console.log(`开始生成商品 ${product.name} 的Excel文件`);
    
    const XLSX = require('xlsx');
    
    // 准备数据
    const excelData = [];
    
    // 添加表头
    excelData.push([
      '日期',
      '商品名称', 
      '商品链接',
      '价格(元)',
      '商品销量',
      '店铺名称',
      '店铺销量',
      '日销量',
      '日GMV(元)'
    ]);
    
    // 添加历史数据
    if (product.dailyData && product.dailyData.length > 0) {
      // 按日期排序
      const sortedData = product.dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      let previousProductSales = 0;
      
      sortedData.forEach((data, index) => {
        const date = moment(data.date).format('YYYY-MM-DD');
        
        // 计算日销量和日GMV
        let dailySales = 0;
        if (index > 0) {
          dailySales = data.productSales - previousProductSales;
        }
        const dailyGMV = dailySales * data.price;
        
        excelData.push([
          date,
          product.name,
          product.url,
          data.price,
          data.productSales,
          product.shopName,
          data.shopSales,
          dailySales,
          dailyGMV
        ]);
        
        previousProductSales = data.productSales;
      });
    } else {
      // 如果没有历史数据，添加当前数据
      excelData.push([
        moment().format('YYYY-MM-DD'),
        product.name,
        product.url,
        product.price,
        product.sales,
        product.shopName,
        product.shopSales,
        0,
        0
      ]);
    }
    
    // 创建工作簿和工作表
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 12 }, // 日期
      { wch: 25 }, // 商品名称
      { wch: 30 }, // 商品链接
      { wch: 10 }, // 价格
      { wch: 12 }, // 商品销量
      { wch: 20 }, // 店铺名称
      { wch: 12 }, // 店铺销量
      { wch: 10 }, // 日销量
      { wch: 12 }  // 日GMV
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, '商品数据');
    
    // 生成Excel文件
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // 设置响应头
    const fileName = `${product.name.replace(/[<>:"/\\|?*]/g, '_')}-数据统计.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    
    console.log(`Excel文件生成完成: ${fileName}`);
    res.send(buffer);
    
  } catch (error) {
    console.error('生成Excel文件失败:', error);
    res.status(500).json({ success: false, message: '生成Excel文件失败: ' + error.message });
  }
}; 