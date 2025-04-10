#!/bin/bash

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
  echo "安装依赖..."
  npm install
fi

echo "生成静态HTML..."
# 先以动态模式启动服务器
export USE_STATIC_HTML=false
node index.js &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 调用API生成静态HTML
curl http://localhost:3000/generate-static
echo ""

# 停止临时服务器
kill $SERVER_PID

# 以静态模式重新启动
echo "以静态模式启动服务器..."
export USE_STATIC_HTML=true
node index.js 