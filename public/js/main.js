document.addEventListener('DOMContentLoaded', () => {
  // 元素
  const productUrlInput = document.getElementById('productUrl');
  const addProductBtn = document.getElementById('addProductBtn');
  const triggerCrawlBtn = document.getElementById('triggerCrawlBtn');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const confirmDialog = document.getElementById('confirmDialog');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  
  // 确保对话框初始状态为隐藏
  if (confirmDialog) {
    confirmDialog.classList.add('hidden');
  }
  
  // API基础路径（支持静态HTML模式和动态模式）
  const API_BASE = window.location.pathname.includes('/index.html') ? '/api' : '';
  
  let currentProductIdToDelete = null;
  

  // 批量添加商品
  addProductBtn.addEventListener('click', async () => {
    const urlsText = productUrlInput.value.trim();
    
    if (!urlsText) {
      showToast('请输入商品链接');
      return;
    }
    
    // 按换行符分割多个链接
    const urls = urlsText.split('\n').filter(url => url.trim() !== '');
    
    if (urls.length === 0) {
      showToast('请输入有效的小红书商品链接');
      return;
    }
    
    // 验证每个链接是否有效
    for (const url of urls) {
      if (!url.includes('xiaohongshu.com')) {
        showToast(`无效的链接: ${url}`);
        return;
      }
    }
    
    showLoading(`准备批量添加 ${urls.length} 个商品...`);
    
    try {
      // 启动批量添加任务（不等待完成）
      const response = await fetch(`${API_BASE}/products/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls })
      });
      
      if (response.ok) {
        // 开始监控进度
        checkBatchAddingProgress();
      } else {
        const data = await response.json();
        showToast('批量添加失败: ' + (data.message || '未知错误'));
        hideLoading();
      }
    } catch (error) {
      showToast('批量添加失败: ' + error.message);
      hideLoading();
    }
  });
  
  // 手动触发爬取
  triggerCrawlBtn.addEventListener('click', async () => {
    try {
      const response = await fetch(`${API_BASE}/trigger-crawl`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('爬取任务已启动');
        checkCrawlingStatus();
      } else {
        showToast('启动爬取失败: ' + data.message);
      }
    } catch (error) {
      showToast('启动爬取失败: ' + error.message);
    }
  });
  
  // 删除商品
  document.addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn')) {
      const btn = e.target.closest('.delete-btn');
      const productId = btn.dataset.id;
      
      console.log('点击删除按钮，商品ID:', productId);
      
      currentProductIdToDelete = productId;
      confirmDialog.classList.remove('hidden');
      
      // 确保对话框可见
      confirmDialog.style.display = 'flex';
    }
  });
  
  // 收藏/取消收藏商品
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.favorite-btn')) {
      const btn = e.target.closest('.favorite-btn');
      const productId = btn.dataset.id;
      
      console.log('点击收藏按钮，商品ID:', productId);
      
      try {
        const response = await fetch(`${API_BASE}/products/${productId}/favorite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          // 更新按钮图标和标题
          const iconSpan = btn.querySelector('.icon');
          if (data.isFavorite) {
            iconSpan.textContent = '❤️';
            btn.title = '取消收藏';
          } else {
            iconSpan.textContent = '🤍';
            btn.title = '添加收藏';
          }
          
          showToast(data.message);
        } else {
          showToast('操作失败: ' + data.message);
        }
      } catch (error) {
        console.error('收藏操作失败:', error);
        showToast('收藏操作失败: ' + error.message);
      }
    }
  });
  
  // 下载Excel数据
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.download-btn')) {
      const btn = e.target.closest('.download-btn');
      const productId = btn.dataset.id;
      
      console.log('点击下载按钮，商品ID:', productId);
      
      try {
        // 显示下载提示
        showToast('正在生成Excel文件...');
        
        // 创建下载链接并触发下载
        const downloadUrl = `${API_BASE}/products/${productId}/excel`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Excel文件下载开始');
      } catch (error) {
        console.error('下载失败:', error);
        showToast('下载失败: ' + error.message);
      }
    }
  });
  
  // 取消删除
  cancelDeleteBtn.addEventListener('click', () => {
    console.log('点击取消删除按钮');
    confirmDialog.classList.add('hidden');
    confirmDialog.style.display = 'none';
    currentProductIdToDelete = null;
  });
  
  // 确认删除
  confirmDeleteBtn.addEventListener('click', async () => {
    console.log('点击确认删除按钮，要删除的商品ID:', currentProductIdToDelete);
    
    if (!currentProductIdToDelete) {
      console.error('没有要删除的商品ID');
      return;
    }
    
    try {
      console.log(`准备发送删除请求: ${API_BASE}/products/${currentProductIdToDelete}`);
      
      const response = await fetch(`${API_BASE}/products/${currentProductIdToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('删除请求状态码:', response.status);
      
      // 即使服务器返回错误，也尝试解析响应
      let data;
      try {
        data = await response.json();
        console.log('删除响应数据:', data);
      } catch (jsonError) {
        console.error('解析响应JSON失败:', jsonError);
        data = { success: response.ok };
      }
      
      if (data.success || response.ok) {
        showToast('商品已删除');
        
        // 从DOM中移除该行
        const row = document.querySelector(`tr[data-id="${currentProductIdToDelete}"]`);
        if (row) {
          row.remove();
          console.log('从DOM中移除行元素成功');
        } else {
          console.error('未找到对应的行元素, ID:', currentProductIdToDelete);
        }
        
        // 更新总数
        const totalCountEl = document.getElementById('totalCount');
        if (totalCountEl) {
          totalCountEl.textContent = parseInt(totalCountEl.textContent) - 1;
          console.log('更新总数成功');
        }
        
        // 刷新页面以确保数据一致性
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        showToast('删除失败: ' + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('删除请求失败:', error);
      showToast('删除失败: ' + error.message);
    } finally {
      confirmDialog.classList.add('hidden');
      confirmDialog.style.display = 'none';
      currentProductIdToDelete = null;
    }
  });
  

  
  // 下载全部数据
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', () => {
      // 目前没有实现全部下载，可以扩展
      showToast('此功能暂未实现');
    });
  }
  
  // 检查爬取状态
  function checkCrawlingStatus() {
    let statusInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/crawl-status`);
        const data = await response.json();
        
        if (data.isActive) {
          showLoading(`正在爬取数据 (${data.current}/${data.total})...`);
        } else {
          hideLoading();
          clearInterval(statusInterval);
          
          // 只有在爬取任务实际运行过后才刷新页面
          if (data.hasOwnProperty('current') && data.hasOwnProperty('total')) {
            // 爬取完成后刷新页面
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('获取爬取状态失败:', error);
        // 发生错误时也清除定时器，避免无限请求
        clearInterval(statusInterval);
      }
    }, 1000);
    
    // 返回定时器ID，方便在需要时手动清除
    return statusInterval;
  }
  
  // 检查批量添加进度
  function checkBatchAddingProgress() {
    let statusInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/crawl-status`);
        const data = await response.json();
        
        if (data.isActive) {
          // 构建详细的进度信息
          let progressMessage = `正在添加商品 (${data.current || 0}/${data.total || 0})`;
          
          if (data.successCount !== undefined && data.failCount !== undefined) {
            progressMessage += `\n成功: ${data.successCount} | 失败: ${data.failCount}`;
          }
          
          if (data.processing && data.processing.length > 0) {
            progressMessage += `\n当前处理: ${data.processing.length} 个并发任务`;
          }
          
          showLoading(progressMessage);
        } else {
          hideLoading();
          clearInterval(statusInterval);
          
          // 批量添加完成，显示最终结果
          if (data.hasOwnProperty('current') && data.hasOwnProperty('total')) {
            const successCount = data.successCount || 0;
            const failCount = data.failCount || 0;
            const total = data.total || 0;
            
            if (total > 0) {
              showToast(`批量添加完成！成功: ${successCount} 个，失败: ${failCount} 个`);
              
              // 清空输入框并刷新页面
              if (productUrlInput) {
                productUrlInput.value = '';
              }
              
              // 延迟刷新页面以显示结果
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          }
        }
      } catch (error) {
        console.error('获取批量添加状态失败:', error);
        // 发生错误时也清除定时器，避免无限请求
        clearInterval(statusInterval);
        hideLoading();
        showToast('获取进度状态失败');
      }
    }, 1000);
    
    // 返回定时器ID，方便在需要时手动清除
    return statusInterval;
  }
  
  // 显示加载遮罩
  function showLoading(message) {
    loadingText.textContent = message || '加载中...';
    loadingOverlay.classList.remove('hidden');
  }
  
  // 隐藏加载遮罩
  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }
  
  // 显示提示
  function showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    
    // 添加样式
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1200';
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }
  
  // 页面加载时检查是否正在爬取
  // 只检查一次，如果没有活动的爬取任务，就不会设置刷新
  (async function() {
    try {
      const response = await fetch(`${API_BASE}/crawl-status`);
      const data = await response.json();
      
      if (data.isActive) {
        // 如果正在爬取，才启动状态检查
        checkCrawlingStatus();
      }
    } catch (error) {
      console.error('获取爬取状态失败:', error);
    }
  })();
}); 