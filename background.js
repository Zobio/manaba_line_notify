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
    testDiscordNotification();
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
      await sendDiscordNotification(newUrgentAssignments);
      
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

// Discord通知送信
async function sendDiscordNotification(urgentAssignments) {
  try {
    const { discordWebhook } = await chrome.storage.local.get(['discordWebhook']);
    
    if (!discordWebhook) {
      console.log('Discord Webhookが設定されていません');
      return;
    }
    
    // 埋め込みメッセージを作成
    const embeds = urgentAssignments.map(assignment => ({
      title: assignment.title,
      description: `**科目:** ${assignment.subject}\n**締切:** ${assignment.dueDate}\n**残り時間:** ${assignment.hoursLeft}時間`,
      color: 0xff4444, // 赤色
      url: assignment.url || undefined,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Manaba課題通知'
      }
    }));
    
    const payload = {
      content: '🚨 **課題の締切が近づいています！**',
      embeds: embeds
    };
    
    // Discord Webhookに送信
    const response = await fetch(discordWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Discord通知を送信しました');
    } else {
      console.error('Discord通知の送信に失敗しました:', response.status);
    }
    
  } catch (error) {
    console.error('Discord通知送信中にエラーが発生しました:', error);
  }
}

// テスト通知
async function testDiscordNotification() {
  try {
    const { discordWebhook } = await chrome.storage.local.get(['discordWebhook']);
    
    if (!discordWebhook) {
      console.log('Discord Webhookが設定されていません');
      return;
    }
    
    const payload = {
      content: '🧪 **Manaba課題通知のテストです**',
      embeds: [{
        title: 'テスト通知',
        description: '設定が正常に動作しています！',
        color: 0x00ff00, // 緑色
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Manaba課題通知'
        }
      }]
    };
    
    const response = await fetch(discordWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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