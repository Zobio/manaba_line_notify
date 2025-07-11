// manabaの課題リストを取得するContent Script

function extractAssignments() {
  const assignments = [];
  
  // 課題テーブルの行を取得
  const rows = document.querySelectorAll('table.stdlist tbody tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      const titleCell = cells[0];
      const statusCell = cells[1];
      const dueDateCell = cells[2];
      const subjectCell = cells[3];
      
      // 課題名とURL
      const titleLink = titleCell.querySelector('a');
      const title = titleLink ? titleLink.textContent.trim() : titleCell.textContent.trim();
      const url = titleLink ? titleLink.href : '';
      
      // 提出状況
      const status = statusCell.textContent.trim();
      
      // 締切日時
      const dueDate = dueDateCell.textContent.trim();
      
      // 科目名
      const subject = subjectCell.textContent.trim();
      
      // 未提出の課題のみを対象にする
      if (status === '未提出' && dueDate && dueDate !== '-') {
        assignments.push({
          title: title,
          url: url,
          status: status,
          dueDate: dueDate,
          subject: subject,
          extractedAt: new Date().toISOString()
        });
      }
    }
  });
  
  return assignments;
}

function parseDate(dateString) {
  // manabaの日付形式を解析 (例: "2024年12月25日 23:59")
  const match = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return new Date(year, month - 1, day, hour, minute);
  }
  return null;
}

function checkDeadlines(assignments) {
  const now = new Date();
  const urgentAssignments = [];
  
  assignments.forEach(assignment => {
    const dueDate = parseDate(assignment.dueDate);
    if (dueDate) {
      const timeDiff = dueDate.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // 24時間以内の課題をチェック
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

// メイン処理
function main() {
  // 課題リストページかどうかをチェック
  if (document.querySelector('table.stdlist')) {
    const assignments = extractAssignments();
    const urgentAssignments = checkDeadlines(assignments);
    
    // background scriptにデータを送信
    chrome.runtime.sendMessage({
      type: 'assignments_updated',
      assignments: assignments,
      urgentAssignments: urgentAssignments
    });
    
    console.log('課題リストを取得しました:', assignments.length, '件');
    console.log('緊急課題:', urgentAssignments.length, '件');
  }
}

// ページ読み込み完了時に実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// 動的コンテンツの変更も監視
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // 課題テーブルが追加された場合
      const hasTable = Array.from(mutation.addedNodes).some(node => 
        node.nodeType === 1 && node.querySelector && node.querySelector('table.stdlist')
      );
      if (hasTable) {
        setTimeout(main, 1000); // 少し待ってから実行
      }
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});