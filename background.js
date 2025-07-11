// Background Script - データ管理とLINE通知

// 初期化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Manaba課題通知拡張機能がインストールされました');
});

// Content Scriptからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'assignments_updated') {
    handleAssignmentsUpdate(message.assignments, message.urgentAssignments);
    sendResponse({ success: true });
  }
  
  if (message.type === 'test_notification') {
    testLineNotification();
    sendResponse({ success: true });
  }
});

// 課題情報の更新処理
async function handleAssignmentsUpdate(assignments, urgentAssignments) {
  try {
    // 既存の課題データを取得
    const { savedAssignments = [], notifiedAssignments = [] } = 
      await chrome.storage.local.get(['savedAssignments', 'notifiedAssignments']);
    
    // 新しい緊急課題をチェック
    const newUrgentAssignments = urgentAssignments.filter(urgent => {
      return !notifiedAssignments.some(notified => 
        notified.title === urgent.title && notified.subject === urgent.subject
      );
    });
    
    // 新しい緊急課題があれば通知
    if (newUrgentAssignments.length > 0) {
      await sendLineNotification(newUrgentAssignments);
      
      // 通知済みリストに追加
      const updatedNotified = [...notifiedAssignments, ...newUrgentAssignments];
      await chrome.storage.local.set({ notifiedAssignments: updatedNotified });
    }
    
    // 課題データを保存
    await chrome.storage.local.set({ 
      savedAssignments: assignments,
      lastUpdated: new Date().toISOString()
    });
    
    // バッジに緊急課題数を表示
    chrome.action.setBadgeText({ 
      text: urgentAssignments.length > 0 ? urgentAssignments.length.toString() : ''
    });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
    
  } catch (error) {
    console.error('課題情報の処理中にエラーが発生しました:', error);
  }
}

// LINE通知送信
async function sendLineNotification(urgentAssignments) {
  try {
    const { lineToken } = await chrome.storage.local.get(['lineToken']);
    
    if (!lineToken) {
      console.log('LINE Notifyトークンが設定されていません');
      return;
    }
    
    // 通知メッセージを作成
    let message = '🚨 課題の締切が近づいています！\n\n';
    
    urgentAssignments.forEach(assignment => {
      message += `📚 ${assignment.subject}\n`;
      message += `📝 ${assignment.title}\n`;
      message += `⏰ 締切: ${assignment.dueDate}\n`;
      message += `🕐 残り時間: ${assignment.hoursLeft}時間\n`;
      if (assignment.url) {
        message += `🔗 ${assignment.url}\n`;
      }
      message += '\n';
    });
    
    // LINE Notify APIに送信
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lineToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        message: message
      })
    });
    
    if (response.ok) {
      console.log('LINE通知を送信しました');
    } else {
      console.error('LINE通知の送信に失敗しました:', response.status);
    }
    
  } catch (error) {
    console.error('LINE通知送信中にエラーが発生しました:', error);
  }
}

// テスト通知
async function testLineNotification() {
  try {
    const { lineToken } = await chrome.storage.local.get(['lineToken']);
    
    if (!lineToken) {
      console.log('LINE Notifyトークンが設定されていません');
      return;
    }
    
    const testMessage = '🧪 Manaba課題通知のテストです\n\n設定が正常に動作しています！';
    
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lineToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        message: testMessage
      })
    });
    
    if (response.ok) {
      console.log('テスト通知を送信しました');
    } else {
      console.error('テスト通知の送信に失敗しました:', response.status);
    }
    
  } catch (error) {
    console.error('テスト通知送信中にエラーが発生しました:', error);
  }
}

// 定期的な通知済みリストのクリーンアップ（7日間保持）
setInterval(async () => {
  try {
    const { notifiedAssignments = [] } = await chrome.storage.local.get(['notifiedAssignments']);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const filteredNotified = notifiedAssignments.filter(item => {
      const itemDate = new Date(item.extractedAt);
      return itemDate > sevenDaysAgo;
    });
    
    await chrome.storage.local.set({ notifiedAssignments: filteredNotified });
  } catch (error) {
    console.error('通知済みリストのクリーンアップ中にエラーが発生しました:', error);
  }
}, 24 * 60 * 60 * 1000); // 24時間ごと