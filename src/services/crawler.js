const puppeteer = require('puppeteer');
const Product = require('../models/product');

// 从文本中提取数字
const extractNumber = (text) => {
  if (!text) return 0;
  
  // 处理 "1.3万" 或 "1.3万+" 格式
  if (text.includes('万')) {
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    return Math.floor(num * 10000);
  }
  
  return parseInt(text.replace(/[^0-9]/g, '')) || 0;
};

// 爬取单个产品数据
const crawlProduct = async (url) => {
  console.log(`开始爬取商品数据: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',  // 使用新的无头模式
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 设置user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // 访问URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // 获取商品名称
    const nameElement = await page.$('div.goods-name');
    const name = nameElement ? await page.evaluate(el => el.textContent, nameElement) : '未知商品';
    
    // 获取商品价格
    let price = 0;
    // 获取所有可能包含价格的元素
    const priceElements = await page.$$('span[data-v-8686a314]');
    
    if (priceElements && priceElements.length > 0) {
      // 遍历所有匹配的元素，寻找包含纯数字的价格
      for (const element of priceElements) {
        const priceText = await page.evaluate(el => el.textContent.trim(), element);
        // 使用正则表达式检查是否为纯数字或带小数点的数字
        if (/^\d+(\.\d+)?$/.test(priceText)) {
          price = parseFloat(priceText);
          break; // 找到价格后退出循环
        }
      }
    }
    
    // 如果上面的方法失败，尝试其他可能的选择器
    if (price === 0) {
      try {
        // 尝试其他可能的价格选择器 (商品详情页中的价格通常有特定样式)
        const altPriceElement = await page.$('.price, .product-price, .goods-price');
        if (altPriceElement) {
          const priceText = await page.evaluate(el => el.textContent.trim(), altPriceElement);
          // 提取数字部分
          const match = priceText.match(/\d+(\.\d+)?/);
          if (match) {
            price = parseFloat(match[0]);
          }
        }
      } catch (priceError) {
        console.warn('尝试替代价格选择器失败:', priceError.message);
      }
    }
    
    // 获取商品销量
    const salesElement = await page.$('span.spu-text');
    let sales = 0;
    if (salesElement) {
      const salesText = await page.evaluate(el => el.textContent, salesElement);
      sales = extractNumber(salesText.replace('已售', ''));
    }
    
    // 获取店铺名称
    const shopNameElement = await page.$('p.seller-name');
    const shopName = shopNameElement ? await page.evaluate(el => el.textContent, shopNameElement) : '未知店铺';
    
    // 获取店铺销量 - 改进版
    let shopSales = 0;
    // 获取所有可能包含店铺销量的元素
    const shopSalesElements = await page.$$('span.sub-title');
    
    if (shopSalesElements && shopSalesElements.length > 0) {
      // 遍历所有匹配的元素，寻找包含"已售"的销量信息
      for (const element of shopSalesElements) {
        const salesText = await page.evaluate(el => el.textContent.trim(), element);
        // 检查文本是否包含"已售"
        if (salesText.includes('已售')) {
          // 提取销量数字
          shopSales = extractNumber(salesText.replace('已售', ''));
          break; // 找到销量后退出循环
        }
      }
    }
    
    // 如果上面的方法失败，尝试其他可能的选择器
    if (shopSales === 0) {
      try {
        // 尝试其他可能的销量选择器
        const altSalesElements = await page.$$('.shop-sales, .seller-info span, .sales-info');
        for (const element of altSalesElements) {
          const salesText = await page.evaluate(el => el.textContent.trim(), element);
          if (salesText.includes('已售') || salesText.includes('销量')) {
            shopSales = extractNumber(salesText);
            break;
          }
        }
      } catch (salesError) {
        console.warn('尝试替代销量选择器失败:', salesError.message);
      }
    }
    
    await browser.close();
    
    console.log(`爬取成功: ${name}, 价格: ${price}, 销量: ${sales}, 店铺: ${shopName}, 店铺销量: ${shopSales}`);
    
    return {
      url,
      name,
      price,
      sales,
      shopName,
      shopSales
    };
    
  } catch (error) {
    console.error(`爬取失败 (${url}):`, error);
    await browser.close();
    throw error;
  }
};

// 爬取所有产品数据
const crawlAllProducts = async () => {
  const products = await Product.find();
  console.log(`开始爬取全部 ${products.length} 个商品的数据`);
  
  let successCount = 0;
  let failCount = 0;
  
  // 串行爬取
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    
    try {
      console.log(`正在爬取 (${i+1}/${products.length}): ${product.url}`);
      const data = await crawlProduct(product.url);
      
      // 计算日增长
      let dailyProductSales = '-';
      let dailyShopSales = '-';
      let dailyGMV = '-';
      
      if (product.sales !== undefined) {
        dailyProductSales = data.sales - product.sales;
        dailyGMV = dailyProductSales * data.price;
      }
      
      if (product.shopSales !== undefined) {
        dailyShopSales = data.shopSales - product.shopSales;
      }
      
      // 更新商品数据
      await Product.findByIdAndUpdate(product._id, {
        name: data.name,
        price: data.price,
        sales: data.sales,
        shopName: data.shopName,
        shopSales: data.shopSales,
        lastUpdated: new Date(),
        dailyProductSales: dailyProductSales !== '-' ? dailyProductSales : 0,
        dailyShopSales: dailyShopSales !== '-' ? dailyShopSales : 0,
        dailyGMV: dailyGMV !== '-' ? dailyGMV : 0,
        $push: {
          dailyData: {
            date: new Date(),
            productSales: data.sales,
            shopSales: data.shopSales,
            price: data.price
          }
        }
      });
      
      successCount++;
      
    } catch (error) {
      console.error(`商品爬取失败 (${product.url}):`, error);
      failCount++;
      // 继续下一个商品的爬取，不影响整体进程
      continue;
    }
    
    // 间隔一段时间再爬取下一个，减少被风控的风险
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
  }
  
  console.log(`爬取完成。成功: ${successCount}, 失败: ${failCount}`);
  return { successCount, failCount };
};

// 爬取单个产品并添加到数据库
const crawlAndAddProduct = async (url) => {
  try {
    // 检查URL是否已存在
    const existingProduct = await Product.findOne({ url });
    if (existingProduct) {
      return { success: false, message: '该商品链接已存在' };
    }
    
    const data = await crawlProduct(url);
    
    // 创建新商品记录
    const newProduct = new Product({
      url: url,
      name: data.name,
      price: data.price,
      sales: data.sales,
      shopName: data.shopName,
      shopSales: data.shopSales,
      dailyData: [{
        date: new Date(),
        productSales: data.sales,
        shopSales: data.shopSales,
        price: data.price
      }],
      // 首次添加没有日增长
      dailyProductSales: 0,
      dailyShopSales: 0,
      dailyGMV: 0
    });
    
    await newProduct.save();
    return { success: true, product: newProduct };
    
  } catch (error) {
    console.error('添加商品失败:', error);
    return { success: false, message: '添加商品失败: ' + error.message };
  }
};

module.exports = {
  crawlProduct,
  crawlAllProducts,
  crawlAndAddProduct
}; 