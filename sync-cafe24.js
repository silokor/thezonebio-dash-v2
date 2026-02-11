const https = require('https');
const fs = require('fs');

// Load tokens
let tokens = JSON.parse(fs.readFileSync('./cafe24-tokens.json', 'utf8'));
const MALL_ID = tokens.mall_id;

// Refresh token if expired
async function refreshTokenIfNeeded() {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();
  
  // Refresh if less than 10 minutes left
  if (expiresAt - now < 10 * 60 * 1000) {
    console.log('Token expired or expiring soon, refreshing...');
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
              console.log('Token refreshed successfully!');
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
  console.log('Token still valid');
}

// Fetch orders
async function fetchOrders() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0]; // 90일
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${MALL_ID}.cafe24api.com`,
      port: 443,
      path: `/api/v2/admin/orders?limit=100&start_date=${startDate}&end_date=${endDate}&embed=items`,
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
          const json = JSON.parse(data);
          if (json.orders) {
            resolve(json.orders);
          } else {
            reject(new Error('Failed to fetch orders: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Fetch order items
async function fetchOrderItems(orderId) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: `${MALL_ID}.cafe24api.com`,
      port: 443,
      path: `/api/v2/admin/orders/${orderId}/items`,
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
          const json = JSON.parse(data);
          resolve(json.items || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Main sync function
async function syncCafe24() {
  console.log('=== Cafe24 Sync Started ===');
  console.log('Time:', new Date().toISOString());
  
  try {
    await refreshTokenIfNeeded();
    const orders = await fetchOrders();
    console.log(`Fetched ${orders.length} orders from Cafe24`);
    
    // Format for dashboard
    const formattedOrders = [];
    for (const order of orders) {
      const items = await fetchOrderItems(order.order_id);
      const itemNames = items.map(i => i.product_name).join(', ') || 'LOCK IN COFFEE';
      const options = items.map(i => i.option_value).filter(Boolean).join(', ') || '-';
      const qty = items.reduce((sum, i) => sum + parseInt(i.quantity || 1), 0) || 1;
      
      formattedOrders.push({
        channel: 'CAFE24',
        order_id: order.order_id,
        order_date: order.order_date,
        customer: order.billing_name || '-',
        product: itemNames.substring(0, 50),
        option: options.substring(0, 30) || '-',
        quantity: qty,
        amount: parseInt(order.payment_amount || 0),
        status: order.canceled === 'T' ? '취소' : (order.paid === 'T' ? '결제완료' : '미결제')
      });
    }
    
    fs.writeFileSync('./cafe24-orders-sync.json', JSON.stringify(formattedOrders, null, 2));
    console.log(`Saved ${formattedOrders.length} formatted orders`);
    
    // Output summary
    formattedOrders.slice(0, 5).forEach((o, i) => {
      console.log(`[${i+1}] ${o.order_id} | ${o.customer} | ${o.amount}원 | ${o.status}`);
    });
    
    console.log('\n=== Cafe24 Sync Complete ===');
    return formattedOrders;
  } catch (error) {
    console.error('Sync failed:', error.message);
    throw error;
  }
}

syncCafe24().catch(console.error);
