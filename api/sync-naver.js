const bcrypt = require('bcryptjs');

// 설정
const NAVER_CLIENT_ID = '34TOeMTHVvJqeYcSqm7Rmh';
const NAVER_CLIENT_SECRET = '$2a$04$E8IpO.Nw.edgzTqtfn09Ve';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgHc3cas4qpK8QjRmqz4AcjqiZ-ifZAB39jqbHibGqeUfDsSL3AdwRXp4VWSh-vb4s/exec';

async function getAccessToken() {
  const timestamp = Date.now();
  const password = `${NAVER_CLIENT_ID}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, NAVER_CLIENT_SECRET);
  const signature = Buffer.from(hashed, 'utf-8').toString('base64');

  const params = new URLSearchParams({
    client_id: NAVER_CLIENT_ID,
    timestamp: timestamp.toString(),
    client_secret_sign: signature,
    grant_type: 'client_credentials',
    type: 'SELF'
  });

  const res = await fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchOrders(accessToken, fromDate, toDate) {
  const url = new URL('https://api.commerce.naver.com/external/v1/pay-order/seller/orders');
  url.searchParams.set('orderSearchType', 'PAYED');
  url.searchParams.set('rangeSearchType', 'PAYED_DATE');
  url.searchParams.set('startDate', fromDate);
  url.searchParams.set('endDate', toDate);

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function fetchOrderDetail(accessToken, productOrderId) {
  const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/${productOrderId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function appendToSheet(order) {
  const url = new URL(GOOGLE_APPS_SCRIPT_URL);
  url.searchParams.set('action', 'append');
  url.searchParams.set('channel', 'naver');
  url.searchParams.set('orderId', order.productOrderId || '');
  url.searchParams.set('orderDate', order.paymentDate || '');
  url.searchParams.set('customerName', order.ordererName || '');
  url.searchParams.set('productName', order.productName || '');
  url.searchParams.set('option', order.optionContent || '일반 포장');
  url.searchParams.set('quantity', order.quantity || 1);
  url.searchParams.set('amount', order.totalPaymentAmount || 0);
  url.searchParams.set('status', '결제완료');
  url.searchParams.set('address', order.shippingAddress?.baseAddress || '');
  url.searchParams.set('addressDetail', order.shippingAddress?.detailedAddress || '');
  url.searchParams.set('deliveryMemo', order.shippingMemo || '');
  url.searchParams.set('phone', order.ordererTel || '');
  url.searchParams.set('zipcode', order.shippingAddress?.zipcode || '');

  const res = await fetch(url);
  return res.json();
}

function getDateStr(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // 1. 토큰 발급
    const accessToken = await getAccessToken();
    
    // 2. 최근 7일 주문 조회
    const fromDate = getDateStr(7);
    const toDate = getDateStr(0);
    const orders = await fetchOrders(accessToken, fromDate, toDate);
    
    if (!orders.data || orders.data.length === 0) {
      return res.json({ success: true, message: '새 주문 없음', count: 0 });
    }
    
    // 3. 각 주문 시트에 추가
    let added = 0, skipped = 0;
    for (const order of orders.data) {
      const detail = await fetchOrderDetail(accessToken, order.productOrderId);
      const result = await appendToSheet(detail);
      if (result.success) added++;
      else skipped++;
    }
    
    return res.json({ 
      success: true, 
      message: `동기화 완료`,
      total: orders.data.length,
      added,
      skipped
    });
    
  } catch (error) {
    console.error('네이버 동기화 에러:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
