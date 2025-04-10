// 立即执行函数，尽快隐藏对话框
(function() {
    var dialog = document.getElementById('confirmDialog');
    if (dialog) {
        dialog.style.display = 'none';
        dialog.classList.add('hidden');
    }
})();

// 页面加载后再次确保对话框隐藏
document.addEventListener('DOMContentLoaded', function() {
    var dialog = document.getElementById('confirmDialog');
    if (dialog) {
        dialog.style.display = 'none';
        dialog.classList.add('hidden');
    }
    
    // 确保取消按钮正常工作
    var cancelBtn = document.getElementById('cancelDeleteBtn');
    if (cancelBtn) {
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            var dialog = document.getElementById('confirmDialog');
            dialog.style.display = 'none';
            dialog.classList.add('hidden');
        };
    }
}); 