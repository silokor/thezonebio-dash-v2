/**
 * 네이버 스마트스토어 주문 동기화
 * 
 * 사용법:
 *   node sync-naver.js
 * 
 * 환경변수 또는 naver-credentials.json 필요:
 *   - NAVER_CLIENT_ID
 *   - NAVER_CLIENT_SECRET
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────
const CREDENTIALS_FILE = path.join(__dirname, 'naver-credentials.json');
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgHc3cas4qpK8QjRmqz4AcjqiZ-ifZAB39jqbHibGqeUfDsSL3AdwRXp4VWSh-vb4s/exec';

// 네이버 커머스 API
const NAVER_API_BASE = 'https://api.commerce.naver.com';
const NAVER_AUTH_URL = 'https://api.commerce.naver.com/external/v1/oauth2/token';

// ─────────────────────────────────────────────
// 인증
// ─────────────────────────────────────────────
function loadCredentials() {
  // 환경변수 우선
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    return {
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET
    };
  }
  
  // 파일에서 로드
  if (fs.existsSync(CREDENTIALS_FILE)) {
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    return {
      clientId: data.clientId,
      clientSecret: data.clientSecret
    };
  }
  
  throw new Error('네이버 API 인증 정보 없음. naver-credentials.json 또는 환경변수 설정 필요');
}

async function getAccessToken(clientId, clientSecret) {
  const bcrypt = require('bcrypt');
  
  // 밀리초 단위 Unix 타임스탬프
  const timestamp = Date.now();
  
  // password: clientId_timestamp
  const password = `${clientId}_${timestamp}`;
  
  // bcrypt 해싱 (clientSecret이 salt 역할)
  const hashed = bcrypt.hashSync(password, clientSecret);
  
  // Base64 인코딩
  const signature = Buffer.from(hashed, 'utf-8').toString('base64');
  
  const params = new URLSearchParams({
    client_id: clientId,
    timestamp: timestamp.toString(),
    client_secret_sign: signature,
    grant_type: 'client_credentials',
    type: 'SELF'
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request(NAVER_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(`토큰 발급 실패: ${data}`));
          }
        } catch (e) {
          reject(new Error(`응답 파싱 실패: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

// ─────────────────────────────────────────────
// 주문 조회
// ─────────────────────────────────────────────
async function fetchOrders(accessToken, fromDate, toDate) {
  const url = new URL(`${NAVER_API_BASE}/external/v1/pay-order/seller/orders`);
  
  // 조회 파라미터
  url.searchParams.set('orderSearchType', 'PAYED'); // 결제완료
  url.searchParams.set('rangeSearchType', 'PAYED_DATE'); // 결제일 기준
  url.searchParams.set('startDate', fromDate); // YYYY-MM-DD
  url.searchParams.set('endDate', toDate);
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`응답 파싱 실패: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function fetchOrderDetail(accessToken, productOrderId) {
  const url = `${NAVER_API_BASE}/external/v1/pay-order/seller/product-orders/${productOrderId}`;
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`응답 파싱 실패: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// ─────────────────────────────────────────────
// Google Sheets 연동
// ─────────────────────────────────────────────
async function appendToSheet(order) {
  const url = new URL(GOOGLE_APPS_SCRIPT_URL);
  url.searchParams.set('action', 'append');
  
  // 시트 컬럼 매핑
  const row = {
    channel: 'naver',
    orderId: order.productOrderId,
    orderDate: order.paymentDate,
    customerName: order.ordererName,
    productName: order.productName,
    option: order.optionContent || '일반 포장',
    quantity: order.quantity,
    amount: order.totalPaymentAmount,
    status: '결제완료',
    courier: '',
    trackingNumber: '',
    address: order.shippingAddress?.baseAddress || '',
    addressDetail: order.shippingAddress?.detailedAddress || '',
    deliveryMemo: order.shippingMemo || '',
    note: '',
    phone: order.ordererTel || '',
    zipcode: order.shippingAddress?.zipcode || ''
  };
  
  Object.entries(row).forEach(([k, v]) => {
    url.searchParams.set(k, v || '');
  });
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    }).on('error', reject);
  });
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  console.log('🛒 네이버 스마트스토어 주문 동기화 시작...\n');
  
  try {
    // 1. 인증 정보 로드
    const { clientId, clientSecret } = loadCredentials();
    console.log(`✓ Client ID: ${clientId.substring(0, 8)}...`);
    
    // 2. 액세스 토큰 발급
    console.log('→ 액세스 토큰 발급 중...');
    const accessToken = await getAccessToken(clientId, clientSecret);
    console.log(`✓ 토큰 발급 완료: ${accessToken.substring(0, 20)}...`);
    
    // 3. 최근 7일 주문 조회
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = weekAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    console.log(`→ 주문 조회: ${fromDate} ~ ${toDate}`);
    const orders = await fetchOrders(accessToken, fromDate, toDate);
    
    if (!orders.data || orders.data.length === 0) {
      console.log('ℹ 새 주문 없음');
      return;
    }
    
    console.log(`✓ ${orders.data.length}건 주문 발견\n`);
    
    // 4. 각 주문 상세 조회 및 시트 추가
    for (const order of orders.data) {
      const detail = await fetchOrderDetail(accessToken, order.productOrderId);
      console.log(`  - ${order.productOrderId}: ${detail.productName} (${detail.ordererName})`);
      
      const result = await appendToSheet(detail);
      if (result.success) {
        console.log(`    ✓ 시트 추가 완료`);
      } else if (result.message?.includes('중복')) {
        console.log(`    ℹ 이미 등록됨`);
      } else {
        console.log(`    ✗ 추가 실패: ${result.error || result.message}`);
      }
    }
    
    console.log('\n✅ 동기화 완료');
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
    process.exit(1);
  }
}

main();
