// Popup UI制御

document.addEventListener('DOMContentLoaded', async () => {
    // 保存されたトークンを読み込み
    const { lineToken } = await chrome.storage.local.get(['lineToken']);
    if (lineToken) {
        document.getElementById('lineToken').value = lineToken;
    }
    
    // 課題状況を表示
    await displayAssignmentStatus();
    
    // イベントリスナーを設定
    setupEventListeners();
});

function setupEventListeners() {
    // トークン保存
    document.getElementById('saveToken').addEventListener('click', async () => {
        const token = document.getElementById('lineToken').value.trim();
        if (token) {
            await chrome.storage.local.set({ lineToken: token });
            showStatus('トークンを保存しました', 'success');
        } else {
            showStatus('トークンを入力してください', 'error');
        }
    });
    
    // テスト通知
    document.getElementById('testNotification').addEventListener('click', async () => {
        const { lineToken } = await chrome.storage.local.get(['lineToken']);
        if (!lineToken) {
            showStatus('先にトークンを保存してください', 'error');
            return;
        }
        
        try {
            await chrome.runtime.sendMessage({ type: 'test_notification' });
            showStatus('テスト通知を送信しました', 'success');
        } catch (error) {
            showStatus('テスト通知の送信に失敗しました', 'error');
        }
    });
    
    // トークン取得リンク
    document.getElementById('getTokenLink').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://notify-bot.line.me/my/' });
    });
}

async function displayAssignmentStatus() {
    try {
        const { savedAssignments = [], lastUpdated } = 
            await chrome.storage.local.get(['savedAssignments', 'lastUpdated']);
        
        const statusDisplay = document.getElementById('statusDisplay');
        const assignmentList = document.getElementById('assignmentList');
        
        if (savedAssignments.length === 0) {
            statusDisplay.textContent = 'まだ課題データがありません。manabaの課題ページを開いてください。';
            statusDisplay.className = 'status info';
            assignmentList.classList.add('hidden');
            return;
        }
        
        // 現在の緊急課題をチェック
        const urgentAssignments = checkCurrentUrgentAssignments(savedAssignments);
        
        // ステータス表示
        if (urgentAssignments.length > 0) {
            statusDisplay.textContent = `🚨 緊急課題: ${urgentAssignments.length}件`;
            statusDisplay.className = 'status error';
        } else {
            statusDisplay.textContent = `✅ 緊急課題はありません（全${savedAssignments.length}件）`;
            statusDisplay.className = 'status success';
        }
        
        // 最終更新時刻を追加
        if (lastUpdated) {
            const updateTime = new Date(lastUpdated).toLocaleString('ja-JP');
            statusDisplay.textContent += `\n最終更新: ${updateTime}`;
        }
        
        // 緊急課題リストを表示
        if (urgentAssignments.length > 0) {
            displayUrgentAssignments(urgentAssignments);
        } else {
            assignmentList.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('課題状況の表示エラー:', error);
        showStatus('課題状況の取得に失敗しました', 'error');
    }
}

function checkCurrentUrgentAssignments(assignments) {
    const now = new Date();
    const urgentAssignments = [];
    
    assignments.forEach(assignment => {
        const dueDate = parseDate(assignment.dueDate);
        if (dueDate) {
            const timeDiff = dueDate.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff > 0 && hoursDiff <= 24) {
                urgentAssignments.push({
                    ...assignment,
                    hoursLeft: Math.round(hoursDiff * 10) / 10
                });
            }
        }
    });
    
    return urgentAssignments;
}

function parseDate(dateString) {
    const match = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
    if (match) {
        const [, year, month, day, hour, minute] = match;
        return new Date(year, month - 1, day, hour, minute);
    }
    return null;
}

function displayUrgentAssignments(urgentAssignments) {
    const assignmentList = document.getElementById('assignmentList');
    assignmentList.innerHTML = '';
    
    urgentAssignments.forEach(assignment => {
        const item = document.createElement('div');
        item.className = 'assignment-item';
        
        item.innerHTML = `
            <div class="assignment-title">${escapeHtml(assignment.title)}</div>
            <div class="assignment-info">
                📚 ${escapeHtml(assignment.subject)}<br>
                ⏰ 締切: ${escapeHtml(assignment.dueDate)}<br>
                🕐 残り: ${assignment.hoursLeft}時間
            </div>
        `;
        
        // クリックでmanabaページを開く
        if (assignment.url) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                chrome.tabs.create({ url: assignment.url });
            });
        }
        
        assignmentList.appendChild(item);
    });
    
    assignmentList.classList.remove('hidden');
}

function showStatus(message, type) {
    const statusDisplay = document.getElementById('statusDisplay');
    statusDisplay.textContent = message;
    statusDisplay.className = `status ${type}`;
    
    // 3秒後に元に戻す
    setTimeout(() => {
        displayAssignmentStatus();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}