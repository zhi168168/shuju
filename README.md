# 小红书数据统计

一个简单的小红书商品数据爬取和统计系统，可以跟踪商品销量变化。

## 功能

- 添加小红书商品链接，自动爬取商品信息（名称、价格、销量等）
- 支持批量添加多条链接（每行一个链接）
- 每天早上8点自动更新所有商品数据
- 跟踪商品和店铺的日销量变化
- 支持按照各种指标排序显示
- 支持导出历史数据
- 支持增加/删除商品

## 服务器信息

- **服务器IP**: 14.103.203.205
- **用户**: root
- **部署目录**: /var/www/xiaohongshu-monitor
- **进程管理**: PM2 (服务名: xiaohongshu-monitor)

## 技术栈

- **后端**: Node.js, Express, MongoDB
- **爬虫**: Puppeteer
- **前端**: HTML, CSS, JavaScript (使用EJS模板引擎)
- **定时任务**: node-cron
- **进程管理**: PM2

## 项目结构

```
xiaohongshu-monitor/
├── index.js                  # 应用入口文件
├── package.json              # 项目依赖配置
├── .env                      # 环境变量配置
├── start.sh                  # 启动脚本
├── static-mode.sh            # 静态模式启动脚本
├── src/
│   ├── controllers/          # 控制器文件夹
│   │   └── productController.js  # 商品控制器
│   ├── models/               # 数据模型文件夹
│   │   └── Product.js        # 商品模型
│   ├── routes/               # 路由文件夹
│   │   └── product.js        # 商品路由
│   ├── services/             # 服务文件夹
│   │   └── crawler.js        # 爬虫服务
│   └── utils/                # 工具文件夹
├── views/                    # 视图文件夹
│   ├── index.ejs             # 首页视图
│   └── error.ejs             # 错误页视图
└── public/                   # 静态资源文件夹
    ├── css/                  # CSS样式
    │   ├── styles.css        # 主样式文件
    │   └── fix_dialog.css    # 对话框样式
    └── js/                   # JavaScript文件
        ├── main.js           # 主逻辑脚本
        └── fix_dialog.js     # 对话框脚本
```

## 核心代码解析

### 1. 爬虫逻辑 (src/services/crawler.js)

爬虫主要通过Puppeteer访问小红书商品页面，并抓取以下信息：

- **商品名称**: 通过`div.goods-name`选择器获取
- **商品价格**: 通过检查多个`span[data-v-8686a314]`元素获取纯数字价格
- **商品销量**: 通过`span.spu-text`获取并处理"万"单位
- **店铺名称**: 通过`p.seller-name`获取
- **店铺销量**: 通过检查多个`span.sub-title`元素获取包含"已售"的内容

爬虫处理逻辑包括：
- 正则表达式提取数字
- 处理"万"单位销量
- 多选择器备选方案
- 防止频繁请求的延迟

### 2. 日销量计算逻辑

系统计算三种日增长数据：

- **商品日销量 (dailyProductSales)**:
  ```javascript
  dailyProductSales = data.sales - product.sales;
  ```
  
- **店铺日销量 (dailyShopSales)**:
  ```javascript
  dailyShopSales = data.shopSales - product.shopSales;
  ```
  
- **商品日GMV (dailyGMV)**:
  ```javascript
  dailyGMV = dailyProductSales * data.price;
  ```

### 3. 定时任务 (index.js)

系统使用node-cron设置定时任务，每天早上8点自动爬取所有商品数据：

```javascript
cron.schedule('0 8 * * *', () => {
  console.log('开始执行每日定时爬取任务...');
  crawlerService.crawlAllProducts().catch(err => {
    console.error('定时爬取任务出错:', err);
  });
}, {
  timezone: 'Asia/Shanghai'
});
```

### 4. 批量添加功能

系统支持批量添加多个链接，逻辑如下：

- 前端通过换行分割多个URL
- 后端接收URL数组并串行处理
- 每个URL爬取之间添加随机延迟（3-5秒）
- 返回成功和失败数量及详情

## 数据模型 (src/models/Product.js)

商品数据模型包含以下字段：

```javascript
{
  url: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  sales: { type: Number, required: true },
  shopName: { type: String, required: true },
  shopSales: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
  dailyData: [{ // 历史数据数组
    date: { type: Date, required: true },
    productSales: { type: Number, required: true },
    shopSales: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  dailyProductSales: { type: Number, default: 0 }, // 商品日销量
  dailyShopSales: { type: Number, default: 0 },    // 店铺日销量
  dailyGMV: { type: Number, default: 0 }           // 商品日GMV
}
```

## 使用说明

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建`.env`文件:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/xiaohongshu-monitor
NODE_ENV=production
USE_STATIC_HTML=false
```

确保已安装和启动MongoDB数据库。

### 3. 启动应用

#### 标准启动
```bash
npm start
```

#### 使用PM2启动
```bash
pm2 start index.js --name xiaohongshu-monitor
```

#### 使用脚本启动
```bash
./start.sh
```

### 4. 重启应用

```bash
pm2 restart xiaohongshu-monitor
```

### 5. 查看日志

```bash
pm2 logs xiaohongshu-monitor
```

## 功能使用指南

### 添加商品

1. 在多行文本框中输入小红书商品链接，每行一个链接
2. 点击"批量新增"按钮
3. 系统会自动爬取并添加所有有效链接的商品

### 查看数据变化

1. 系统每天早上8点自动更新所有商品数据
2. 数据更新后，商品日销量、店铺日销量、商品日GMV会显示在表格中
3. 首次添加的商品没有日销量数据，等待下一次更新后才会显示

### 导出数据

点击商品行右侧的下载按钮，可以导出单个商品的历史数据为CSV格式。

### 删除商品

点击商品行右侧的删除按钮，确认后可以删除该商品。

## 注意事项

1. 爬虫依赖于小红书网页结构，如果网站改版可能需要更新选择器
2. 批量添加过多商品可能触发小红书的反爬机制，建议每次不超过10个链接
3. 服务器需要足够内存运行Puppeteer（建议至少1GB可用内存）
4. 日销量数据是相对于上次爬取的增长量，并非绝对的每日销量

## 维护和故障排除

### 常见问题

1. **爬取失败或数据不准确**: 检查网页结构是否变化，可能需要更新选择器
2. **内存占用过高**: 减少并发爬取数量，确保每次关闭浏览器
3. **数据库连接失败**: 检查MongoDB连接配置和服务状态

### 更新爬虫

如果小红书网站结构变化，需要更新爬虫代码：

1. 修改`src/services/crawler.js`中的选择器
2. 测试新的选择器是否能正确获取数据
3. 重启服务应用更改

---

项目维护者: [维护者名称]
最后更新: 2023-08-18