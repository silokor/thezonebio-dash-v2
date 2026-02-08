#!/usr/bin/env node
/**
 * 더존바이오 주문 동기화 스크립트
 * - 쿠팡: API 사용
 * - 네이버/카페24: 스크래핑 필요 (별도 구현)
 * 
 * 사용법: node sync-orders.js
 */

const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============ 쿠팡 API 설정 ============
const COUPANG_CONFIG = {
  accessKey: '5ef5dee7-6ea8-4fd5-b163-d0a3a07898b6',
  secretKey: '156e04011d9a66efbd026af33ddf43c5ddcfeab7',
  vendorId: 'A01543508',
  baseUrl: 'https://api-gateway.coupang.com'
};

// Google Sheets 설정
const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';

// ============ HMAC 서명 생성 (쿠팡 공식 형식) ============
function generateHmacSignature(method, path, datetime) {
  // 쿠팡 서명 형식: datetime + method + path (datetime에 Z 없음)
  const message = datetime + method + path;
  console.log('[DEBUG] Message:', message);
  const signature = crypto
    .createHmac('sha256', COUPANG_CONFIG.secretKey)
    .update(message)
    .digest('hex');
  return signature;
}

function generateAuthHeader(method, path) {
  // 날짜 형식: yyMMddTHHmmss (예: 260208T072158)
  // 쿠팡 공식: new Date().toISOString().substr(2,17).replace(/[-:]/gi, '')
  // 2026-02-08T07:22:58.123Z -> substr(2,17) = "26-02-08T07:22:5" (17자)
  // replace -> "260208T07225" (잘못됨)
  // 실제로는 substr(2,15)가 맞을 수 있음
  const now = new Date();
  const iso = now.toISOString(); // "2026-02-08T07:22:58.123Z"
  // yyMMdd'T'HHmmss = 260208T072258
  const datetime = iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10) + 'T' + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19);
  
  const signature = generateHmacSignature(method, path, datetime);
  
  console.log('[DEBUG] DateTime:', datetime);
  console.log('[DEBUG] Signature:', signature);
  
  return {
    'Authorization': `CEA algorithm=HmacSHA256, access-key=${COUPANG_CONFIG.accessKey}, signed-date=${datetime}, signature=${signature}`,
    'Content-Type': 'application/json;charset=UTF-8'
  };
}

// ============ 쿠팡 API 호출 ============
function coupangApiRequest(method, apiPath) {
  return new Promise((resolve, reject) => {
    const headers = generateAuthHeader(method, apiPath);
    const url = new URL(COUPANG_CONFIG.baseUrl + apiPath);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// ============ 쿠팡 주문 조회 ============
async function fetchCoupangOrders() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // 주문 목록 조회 API
  const apiPath = `/v2/providers/openapi/apis/api/v4/vendors/${COUPANG_CONFIG.vendorId}/ordersheets?createdAtFrom=${startDate}&createdAtTo=${endDate}&status=ACCEPT`;
  
  console.log('[쿠팡] 주문 조회 중...');
  console.log('API Path:', apiPath);
  
  try {
    const result = await coupangApiRequest('GET', apiPath);
    console.log('[쿠팡] API 응답:', JSON.stringify(result, null, 2).slice(0, 500));
    return result;
  } catch (error) {
    console.error('[쿠팡] API 에러:', error.message);
    return null;
  }
}

// ============ Google Sheets 업데이트 ============
function updateGoogleSheets(orders) {
  if (!orders || orders.length === 0) {
    console.log('[시트] 업데이트할 주문 없음');
    return;
  }
  
  // 현재 시트 데이터 가져오기
  const currentData = execSync(`gog sheets get ${SHEET_ID} "시트1!A:L" --json 2>/dev/null`).toString();
  const sheetData = JSON.parse(currentData);
  const existingOrderIds = new Set(sheetData.values?.slice(1).map(row => row[1]) || []);
  
  // 새 주문 필터링
  const newOrders = orders.filter(order => !existingOrderIds.has(order.orderId));
  
  if (newOrders.length === 0) {
    console.log('[시트] 새 주문 없음');
    return;
  }
  
  // 시트에 추가할 행 생성
  const rows = newOrders.map(order => [
    order.channel || 'coupang',
    order.orderId,
    order.orderDate,
    order.customerName,
    order.productName,
    order.option || '-',
    order.quantity,
    order.amount,
    order.status,
    order.courier || '',
    order.trackingNumber || '',
    order.note || ''
  ]);
  
  // gog sheets append로 추가
  const rowsJson = JSON.stringify(rows);
  execSync(`gog sheets append ${SHEET_ID} "시트1!A:L" --values-json '${rowsJson}'`);
  console.log(`[시트] ${newOrders.length}개 주문 추가됨`);
}

// ============ 메인 실행 ============
async function main() {
  console.log('='.repeat(50));
  console.log('더존바이오 주문 동기화 시작:', new Date().toLocaleString('ko-KR'));
  console.log('='.repeat(50));
  
  // 1. 쿠팡 주문 조회
  const coupangResult = await fetchCoupangOrders();
  
  if (coupangResult && coupangResult.data) {
    console.log(`[쿠팡] ${coupangResult.data.length || 0}개 주문 조회됨`);
    
    // 주문 데이터 변환
    const orders = (coupangResult.data || []).map(order => ({
      channel: 'coupang',
      orderId: order.orderId?.toString(),
      orderDate: order.orderedAt,
      customerName: order.receiver?.name || order.orderer?.name,
      productName: 'LOCK IN COFFEE',
      option: order.vendorItems?.[0]?.vendorItemName || '-',
      quantity: order.vendorItems?.[0]?.shippingCount || 1,
      amount: order.vendorItems?.[0]?.orderPrice || 0,
      status: order.status,
      courier: order.deliveryCompanyName || '',
      trackingNumber: order.invoiceNumber || '',
      note: ''
    }));
    
    // 시트 업데이트
    // updateGoogleSheets(orders);  // 테스트 후 활성화
  }
  
  console.log('\n동기화 완료:', new Date().toLocaleString('ko-KR'));
}

// 실행
main().catch(console.error);
