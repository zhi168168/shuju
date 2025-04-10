#!/bin/bash

echo "上传修改后的文件到服务器..."

# 上传修改后的控制器文件
echo "上传控制器文件..."
scp src/controllers/productController.js root@14.103.203.205:/var/www/xiaohongshu-monitor/src/controllers/

# 上传修改后的主入口文件
echo "上传主入口文件..."
scp index.js root@14.103.203.205:/var/www/xiaohongshu-monitor/

# 上传数据库验证脚本
echo "上传数据库验证脚本..."
scp db-verify.js root@14.103.203.205:/var/www/xiaohongshu-monitor/

# 登录服务器执行验证并重启应用
echo "登录服务器验证数据库并重启应用..."
ssh root@14.103.203.205 << 'EOF'
cd /var/www/xiaohongshu-monitor

# 先验证数据库
echo "验证数据库..."
node db-verify.js

# 确保环境变量设置正确
echo "PORT=3000
MONGODB_URI=mongodb://localhost:27017/xiaohongshu-monitor
NODE_ENV=production
USE_STATIC_HTML=false" > .env

# 关闭之前的应用
pkill -f "node index.js" || true

# 启动应用
echo "重启应用..."
node index.js > app.log 2>&1 &

# 显示日志
sleep 2
tail -n 20 app.log

echo "应用已重启，正在监听0.0.0.0:3000"
EOF

echo "完成！请访问 http://14.103.203.205:3000" 