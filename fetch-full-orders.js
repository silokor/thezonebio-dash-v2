const https = require('https');
const fs = require('fs');

// Load tokens
let tokens = JSON.parse(fs.readFileSync('./cafe24-tokens.json', 'utf8'));
const MALL_ID = tokens.mall_id;

// Refresh token
async function refreshToken() {
  console.log('Refreshing token...');
  const credentials = Buffer.from(`${tokens.client_id}:${tokens.client_secret}`).toString('base64');
  
  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token
  }).toString();
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${MALL_ID}.cafe24api.com`,
      port: 443,
      path: '/api/v2/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const newTokens = JSON.parse(data);
          if (newTokens.access_token) {
            tokens.access_token = newTokens.access_token;
            tokens.refresh_token = newTokens.refresh_token;
            tokens.expires_at = newTokens.expires_at;
            tokens.refresh_token_expires_at = newTokens.refresh_token_expires_at;
            fs.writeFileSync('./cafe24-tokens.json', JSON.stringify(tokens, null, 2));
            console.log('Token refreshed:', tokens.access_token.substring(0, 10) + '...');
            resolve();
          } else {
            reject(new Error('Token refresh failed: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// API request helper
function apiRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${MALL_ID}.cafe24api.com`,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2025-12-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Fetch orders with items
async function fetchOrders() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 60*24*60*60*1000).toISOString().split('T')[0]; // 60일
  
  const result = await apiRequest(`/api/v2/admin/orders?limit=100&start_date=${startDate}&end_date=${endDate}`);
  return result.orders || [];
}

// Fetch order items
async function fetchOrderItems(orderId) {
  const result = await apiRequest(`/api/v2/admin/orders/${orderId}/items`);
  return result.items || [];
}

// Fetch receivers (배송지 정보)
async function fetchReceivers(orderId) {
  const result = await apiRequest(`/api/v2/admin/orders/${orderId}/receivers`);
  return result.receivers || [];
}

// Main
async function main() {
  console.log('=== Cafe24 Full Order Fetch ===\n');
  
  await refreshToken();
  
  const orders = await fetchOrders();
  console.log(`Found ${orders.length} orders\n`);
  
  const fullOrders = [];
  
  for (const order of orders) {
    console.log(`Processing ${order.order_id}...`);
    
    // Get items
    const items = await fetchOrderItems(order.order_id);
    
    // Get receiver info
    const receivers = await fetchReceivers(order.order_id);
    const receiver = receivers[0] || {};
    
    // Format items for display
    const itemDetails = items.map(item => ({
      name: item.product_name,
      option: item.option_value || '-',
      qty: parseInt(item.quantity) || 1,
      price: parseInt(item.product_price) || 0
    }));
    
    // Product summary (품목명 + 맛별 수량)
    const productSummary = itemDetails.map(i => 
      `${i.name}${i.option !== '-' ? ` (${i.option})` : ''}`
    ).join(', ');
    
    const optionSummary = itemDetails.map(i => 
      `${i.option !== '-' ? i.option : i.name.replace('LOCK IN COFFEE ', '')} x${i.qty}`
    ).join(', ');
    
    const totalQty = itemDetails.reduce((sum, i) => sum + i.qty, 0);
    
    fullOrders.push({
      channel: 'CAFE24',
      order_id: order.order_id,
      order_date: order.order_date,
      customer: receiver.name || order.billing_name || '-',
      product: productSummary.substring(0, 100) || 'LOCK IN COFFEE',
      option: optionSummary.substring(0, 50) || '-',
      quantity: totalQty,
      amount: parseInt(order.actual_order_amount?.payment_amount || order.payment_amount || 0),
      status: order.canceled === 'T' ? '취소' : (order.paid === 'T' ? '결제완료' : '미결제'),
      carrier: '',
      tracking: '',
      address: receiver.address1 || '',
      address2: receiver.address2 || '',
      memo: receiver.shipping_message || '',
      note: '',
      phone: receiver.phone || receiver.cellphone || '',
      zipcode: receiver.zipcode || ''
    });
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Save results
  fs.writeFileSync('./cafe24-full-orders.json', JSON.stringify(fullOrders, null, 2));
  
  console.log('\n=== Results ===\n');
  fullOrders.forEach((o, i) => {
    console.log(`[${i+1}] ${o.order_id}`);
    console.log(`    고객: ${o.customer}`);
    console.log(`    품목: ${o.product}`);
    console.log(`    옵션: ${o.option}`);
    console.log(`    수량: ${o.quantity}개, 금액: ${o.amount.toLocaleString()}원`);
    console.log(`    전화: ${o.phone}`);
    console.log(`    우편: ${o.zipcode}`);
    console.log(`    주소: ${o.address} ${o.address2}`);
    console.log('');
  });
  
  console.log(`\nSaved to cafe24-full-orders.json`);
}

main().catch(console.error);
