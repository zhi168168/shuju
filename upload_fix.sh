#!/bin/bash

# 上传修改后的CSS文件
echo "上传修改后的CSS文件..."
scp public/css/styles.css root@14.103.203.205:/var/www/xiaohongshu-monitor/public/css/

# 登录服务器并重新生成静态HTML
echo "登录服务器并重新生成静态HTML..."
ssh root@14.103.203.205 "cd /var/www/xiaohongshu-monitor && ./static-mode.sh"

echo "修复完成！请刷新页面检查问题是否解决。" 