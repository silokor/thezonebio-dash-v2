// TelegramNotify.gs - 서버리스 주문 알림
// 야간 시간 (21:00~09:00) 알림 제외

const TELEGRAM_TOKEN = '8241882418:AAE2fUgMBghj90Xyp_l9xRVxjFxv-XonFpE';
const CHAT_ID = '-1003811535076';
const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';

// 야간 시간 설정 (알림 안 보내는 시간)
const QUIET_START = 21; // 오후 9시
const QUIET_END = 9;    // 오전 9시

function checkAndNotify() {
  // 야간 시간 체크 (한국 시간 기준)
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hour = koreaTime.getHours();
  
  if (hour >= QUIET_START || hour < QUIET_END) {
    // 21:00 ~ 08:59 → 알림 스킵
    return;
  }
  
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('시트1');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 컬럼 인덱스 찾기
  const colIdx = {
    channel: headers.indexOf('채널'),
    orderId: headers.indexOf('주문번호'),
    orderDate: headers.indexOf('주문일시'),
    customer: headers.indexOf('고객명'),
    product: headers.indexOf('상품명'),
    option: headers.indexOf('옵션'),
    qty: headers.indexOf('수량'),
    amount: headers.indexOf('금액'),
    status: headers.indexOf('배송상태')
  };
  
  const pendingStatuses = ['결제완료', '배송준비완료', '배송준비중'];
  const pending = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[colIdx.status];
    
    if (pendingStatuses.includes(status)) {
      const orderDate = new Date(row[colIdx.orderDate]);
      const daysOld = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
      
      pending.push({
        channel: row[colIdx.channel] || '?',
        orderId: row[colIdx.orderId],
        orderDate: Utilities.formatDate(orderDate, 'Asia/Seoul', 'M/d'),
        customer: row[colIdx.customer],
        product: row[colIdx.product],
        option: row[colIdx.option] || '',
        qty: row[colIdx.qty],
        amount: row[colIdx.amount],
        status: status,
        delayed: daysOld >= 2
      });
    }
  }
  
  if (pending.length === 0) {
    return;
  }
  
  // 메시지 구성
  const delayed = pending.filter(o => o.delayed);
  let msg = `📦 *미처리 주문 ${pending.length}건*\n`;
  
  if (delayed.length > 0) {
    msg += `🚨 *${delayed.length}건 지연 (2일+)*\n`;
  }
  
  msg += `\n`;
  
  pending.forEach(o => {
    const warn = o.delayed ? '🚨 ' : '';
    const optionStr = o.option ? ` (${o.option})` : '';
    msg += `${warn}${o.orderDate} | ${o.customer} | ${o.product}${optionStr} x${o.qty}\n`;
  });
  
  msg += `\n🔗 [대시보드](https://thezonebio-dash-v2.vercel.app/)`;
  
  sendTelegram(msg);
}

function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  
  const payload = {
    chat_id: CHAT_ID,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}

// 테스트용 함수
function testNotify() {
  sendTelegram('🧪 테스트: Apps Script 알림 연동 성공!');
}
