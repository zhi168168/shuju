require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const moment = require('moment-timezone');
const fs = require('fs');

const productRoutes = require('./src/routes/product');
const crawlerService = require('./src/services/crawler');

const app = express();
const PORT = process.env.PORT || 3000;
const USE_STATIC_HTML = process.env.USE_STATIC_HTML === 'true';

// 设置视图引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 如果启用了静态HTML模式，则使用预生成的HTML文件
if (USE_STATIC_HTML) {
  console.log('使用静态HTML模式');
  
  // 主页路由改为提供静态HTML文件
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  
  // API路由依然保持动态
  app.use('/api', productRoutes);
} else {
  // 正常使用动态路由
  app.use('/', productRoutes);
}

// 连接数据库
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('数据库连接成功');
})
.catch(err => {
  console.error('数据库连接失败:', err);
});

// 定时任务 - 每天早上8点自动爬取数据
cron.schedule('0 8 * * *', () => {
  console.log('开始执行每日定时爬取任务...');
  crawlerService.crawlAllProducts().catch(err => {
    console.error('定时爬取任务出错:', err);
  });
}, {
  timezone: 'Asia/Shanghai'
});

// 生成静态HTML的辅助函数
app.get('/generate-static', async (req, res) => {
  try {
    const Product = require('./src/models/product');
    const products = await Product.find().sort({ lastUpdated: -1 });
    
    // 渲染模板
    app.render('index', { 
      products,
      moment,
      currentSort: 'lastUpdated',
      currentOrder: 'desc'
    }, (err, html) => {
      if (err) {
        console.error('生成静态HTML失败:', err);
        return res.status(500).send('生成失败');
      }
      
      // 保存为静态HTML文件
      fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), html, 'utf8');
      res.send('静态HTML已生成');
    });
  } catch (error) {
    console.error('生成静态HTML失败:', error);
    res.status(500).send('生成失败');
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
}); 