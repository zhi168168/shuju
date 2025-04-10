const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/productController');

const router = express.Router();

// 获取产品列表页面
router.get('/', productController.getProducts);

// API路由
// 添加新产品
router.post('/products', [
  body('url').isURL().withMessage('请输入有效的URL')
], productController.addProduct);

// 添加批量添加的路由
router.post('/products/batch', [
  body('urls').isArray().withMessage('请提供有效的URL数组')
], productController.batchAddProducts);

// 删除产品
router.delete('/products/:id', productController.deleteProduct);

// 获取产品历史数据（用于下载）
router.get('/products/:id/history', productController.getProductHistory);

// 获取爬取状态
router.get('/crawl-status', productController.getCrawlingStatus);

// 触发手动爬取
router.post('/trigger-crawl', productController.triggerCrawl);

module.exports = router; 