/**
 * 주문 알림 스크립트 v2
 * - 3개 채널 동기화 후
 * - Google Sheets에서 배송 대기 주문 조회 (gog CLI)
 * - 채널별/날짜별 그룹핑 + 지연 경고
 * - 텔레그램 알림
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = '8241882418:AAE2fUgMBghj90Xyp_l9xRVxjFxv-XonFpE';
const TELEGRAM_CHAT_ID = '7210253956';
const DASHBOARD_URL = 'https://thezonebio-dash-v2.vercel.app/';
const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';

const SCRIPTS = {
  cafe24: path.join(__dirname, 'sync-cafe24.js'),
  coupang: path.join(__dirname, 'sync-coupang.js'),
  naver: path.join(__dirname, 'sync-naver.js')
};

const CHANNEL_NAMES = {
  cafe24: '카페24',
  coupang: '쿠팡',
  naver: '네이버'
};

// 배송 대기 상태
const PENDING_STATUSES = ['결제완료', '배송준비완료', '배송준비중'];

// ─────────────────────────────────────────────
// 텔레그램 전송
// ─────────────────────────────────────────────
function sendTelegram(message) {
  // Use curl for reliability
  try {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    const result = execSync(`curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -H "Content-Type: application/json" -d '${data.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf8',
      timeout: 30000
    });
    
    return Promise.resolve(JSON.parse(result));
  } catch (error) {
    return Promise.reject(error);
  }
}

// ─────────────────────────────────────────────
// 동기화 스크립트 실행
// ─────────────────────────────────────────────
function runSync(channel) {
  const script = SCRIPTS[channel];
  if (!script) return { channel, added: 0 };

  try {
    const output = execSync(`node "${script}"`, {
      encoding: 'utf8',
      timeout: 120000,
      cwd: __dirname
    });
    const added = (output.match(/시트 추가 완료/g) || []).length;
    return { channel, added, output };
  } catch (error) {
    return { channel, added: 0, error: error.message };
  }
}

// ─────────────────────────────────────────────
// Google Sheets에서 주문 조회 (gog CLI)
// ─────────────────────────────────────────────
function getOrdersFromSheet() {
  try {
    const output = execSync(`gog sheets get ${SHEET_ID} "시트1!A:Q" --json`, {
      encoding: 'utf8',
      timeout: 30000
    });
    const data = JSON.parse(output);
    const rows = data.values || [];
    
    if (rows.length < 2) return [];
    
    const headers = rows[0];
    const orders = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const order = {};
      headers.forEach((h, idx) => {
        order[h] = row[idx] || '';
      });
      orders.push(order);
    }
    
    return orders;
  } catch (error) {
    console.error('시트 조회 실패:', error.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// 날짜 파싱 & 지연 계산
// ─────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  // "2026-02-10 14:30" or "2026-02-10"
  const match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
}

function getDaysAgo(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  const date = parseDate(dateStr);
  if (!date) return '??';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ─────────────────────────────────────────────
// 상품명 축약
// ─────────────────────────────────────────────
function shortenProduct(name) {
  if (!name) return '상품';
  // "LOCK IN COFFEE::DECAF" -> "DECAF"
  // "LOCK IN COFFEE" -> "LOCK IN"
  if (name.includes('::')) {
    const parts = name.split('::');
    return parts[parts.length - 1].split(',')[0].trim();
  }
  if (name.includes('DECAF')) return 'DECAF';
  if (name.includes('VIBRANT')) return 'VIBRANT';
  if (name.includes('HOUSE')) return 'HOUSE';
  if (name.includes('Tasting')) return 'Tasting Kit';
  return name.substring(0, 15);
}

// ─────────────────────────────────────────────
// 메시지 포맷팅
// ─────────────────────────────────────────────
function formatOrderMessage(pendingOrders, newCounts) {
  const lines = [];
  
  // 신규 주문 있으면 헤더에 표시
  const totalNew = Object.values(newCounts).reduce((a, b) => a + b, 0);
  if (totalNew > 0) {
    lines.push(`🛒 <b>신규 주문 ${totalNew}건</b>\n`);
  } else {
    lines.push(`📋 <b>배송 대기 주문 현황</b>\n`);
  }

  // 채널별 그룹핑
  const byChannel = {};
  let delayCount = 0;

  for (const order of pendingOrders) {
    const ch = (order['채널'] || 'unknown').toLowerCase();
    if (!byChannel[ch]) byChannel[ch] = [];
    
    const daysAgo = getDaysAgo(order['주문일시']);
    const isDelayed = daysAgo >= 2;
    if (isDelayed) delayCount++;

    byChannel[ch].push({
      customerName: order['고객명'],
      productName: order['상품명'],
      quantity: order['수량'] || '1',
      orderDate: order['주문일시'],
      status: order['배송상태'],
      daysAgo,
      isDelayed,
      dateFormatted: formatDate(order['주문일시'])
    });
  }

  // 각 채널별 출력
  for (const [ch, chOrders] of Object.entries(byChannel)) {
    const chName = CHANNEL_NAMES[ch] || ch;
    const newCount = newCounts[ch] || 0;
    const newBadge = newCount > 0 ? ` ✨${newCount}` : '';
    
    lines.push(`<b>📦 ${chName} (${chOrders.length}건)${newBadge}</b>`);

    // 날짜순 정렬 (오래된 것 먼저 = 지연 먼저)
    chOrders.sort((a, b) => b.daysAgo - a.daysAgo);

    for (let i = 0; i < chOrders.length; i++) {
      const o = chOrders[i];
      const prefix = i === chOrders.length - 1 ? '└' : '├';
      const delay = o.isDelayed ? ' 🚨' : '';
      const product = shortenProduct(o.productName);
      
      lines.push(`${prefix} ${o.dateFormatted} ${o.customerName} - ${product} x${o.quantity}${delay}`);
    }
    lines.push('');
  }

  // 지연 경고
  if (delayCount > 0) {
    lines.push(`⚠️ <b>지연 ${delayCount}건</b> (2일+) 빨리 보내세요!`);
    lines.push('');
  }

  lines.push(`📊 <a href="${DASHBOARD_URL}">대시보드에서 확인</a>`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  console.log('🔔 주문 알림 체크 시작...\n');

  // 1. 각 채널 동기화
  const newCounts = {};
  for (const channel of ['cafe24', 'coupang', 'naver']) {
    console.log(`→ ${CHANNEL_NAMES[channel]} 동기화...`);
    const result = runSync(channel);
    newCounts[channel] = result.added || 0;
    
    if (result.added > 0) {
      console.log(`  ✓ ${result.added}건 신규`);
    } else {
      console.log(`  ℹ 새 주문 없음`);
    }
  }

  // 2. Google Sheets에서 배송 대기 주문 조회
  console.log('\n→ 배송 대기 주문 조회...');
  const allOrders = getOrdersFromSheet();
  const pendingOrders = allOrders.filter(o => 
    PENDING_STATUSES.includes(o['배송상태'])
  );
  console.log(`  ✓ 전체 ${allOrders.length}건 중 대기 ${pendingOrders.length}건`);

  // 3. 알림 전송 조건
  const hasNew = Object.values(newCounts).some(c => c > 0);
  const hasDelayed = pendingOrders.some(o => getDaysAgo(o['주문일시']) >= 2);
  const hasPending = pendingOrders.length > 0;

  if (hasNew || hasDelayed) {
    const message = formatOrderMessage(pendingOrders, newCounts);
    console.log('\n→ 텔레그램 알림 전송...');
    
    try {
      await sendTelegram(message);
      console.log('✓ 전송 완료');
    } catch (error) {
      console.error('✗ 전송 실패:', error.message);
    }
  } else if (hasPending) {
    console.log(`\nℹ 대기 ${pendingOrders.length}건 있으나 신규/지연 없어 알림 생략`);
  } else {
    console.log('\nℹ 배송 대기 주문 없음');
  }

  console.log('\n✅ 완료');
}

main().catch(console.error);
