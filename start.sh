#!/bin/bash

# 确保MongoDB服务正在运行
if command -v mongod &> /dev/null; then
  echo "检查MongoDB服务..."
  if ! pgrep -x "mongod" > /dev/null; then
    echo "MongoDB没有运行，尝试启动..."
    mongod --dbpath=/data/db &
    sleep 2
  else
    echo "MongoDB服务已在运行中"
  fi
else
  echo "警告: 未检测到MongoDB，请确保MongoDB已安装并运行"
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "安装依赖..."
  npm install
else
  echo "依赖已安装"
fi

# 启动应用
echo "启动小红书数据统计应用..."
npm start 