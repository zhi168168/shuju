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
  
  // 添加商品
  addProductBtn.addEventListener('click', async () => {
    const url = productUrlInput.value.trim();
    
    if (!url) {
      showToast('请输入商品链接');
      return;
    }
    
    if (!url.includes('xiaohongshu.com')) {
      showToast('请输入有效的小红书商品链接');
      return;
    }
    
    showLoading('正在爬取商品数据...');
    
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('商品添加成功');
        productUrlInput.value = '';
        
        // 刷新页面显示新数据
        window.location.reload();
      } else {
        showToast('添加失败: ' + data.message);
      }
    } catch (error) {
      showToast('添加失败: ' + error.message);
    } finally {
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
      
      currentProductIdToDelete = productId;
      confirmDialog.classList.remove('hidden');
    }
  });
  
  // 取消删除
  cancelDeleteBtn.addEventListener('click', () => {
    confirmDialog.classList.add('hidden');
    currentProductIdToDelete = null;
  });
  
  // 确认删除
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentProductIdToDelete) return;
    
    try {
      const response = await fetch(`${API_BASE}/products/${currentProductIdToDelete}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('商品已删除');
        
        // 从DOM中移除该行
        const row = document.querySelector(`tr[data-id="${currentProductIdToDelete}"]`);
        if (row) {
          row.remove();
        }
        
        // 更新总数
        const totalCountEl = document.getElementById('totalCount');
        if (totalCountEl) {
          totalCountEl.textContent = parseInt(totalCountEl.textContent) - 1;
        }
      } else {
        showToast('删除失败: ' + data.message);
      }
    } catch (error) {
      showToast('删除失败: ' + error.message);
    } finally {
      confirmDialog.classList.add('hidden');
      currentProductIdToDelete = null;
    }
  });
  
  // 下载历史数据
  document.addEventListener('click', (e) => {
    if (e.target.closest('.download-btn')) {
      const btn = e.target.closest('.download-btn');
      const productId = btn.dataset.id;
      
      window.location.href = `${API_BASE}/products/${productId}/history`;
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
          // 爬取完成后刷新页面
          window.location.reload();
        }
      } catch (error) {
        console.error('获取爬取状态失败:', error);
      }
    }, 1000);
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
  checkCrawlingStatus();
}); 