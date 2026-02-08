const crypto = require('crypto');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');

// Coupang API Credentials
const CONFIG = {
  vendorId: 'A01543508',
  accessKey: '5ef5dee7-6ea8-4fd5-b163-d0a3a07898b6',
  secretKey: '156e04011d9a66efbd026af33ddf43c5ddcfeab7',
  host: 'api-gateway.coupang.com'
};

const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';

// Generate datetime in Coupang format
function getCoupangDatetime() {
  return new Date().toISOString().substr(2, 17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';
}

// Make API request
function apiRequest(method, path, queryParams = {}) {
  return new Promise((resolve, reject) => {
    const query = Object.keys(queryParams).length > 0
      ? Object.entries(queryParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : '';
    
    const datetime = getCoupangDatetime();
    const message = datetime + method + path + query;
    
    const signature = crypto
      .createHmac('sha256', CONFIG.secretKey)
      .update(message)
      .digest('hex');
    
    const authorization = `CEA algorithm=HmacSHA256, access-key=${CONFIG.accessKey}, signed-date=${datetime}, signature=${signature}`;
    
    const urlPath = query ? `${path}?${query}` : path;

    const options = {
      hostname: CONFIG.host,
      port: 443,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': authorization,
        'X-EXTENDED-TIMEOUT': 90000
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Get orders by status
async function getOrdersByStatus(createdAtFrom, createdAtTo, status) {
  const path = `/v2/providers/openapi/apis/api/v4/vendors/${CONFIG.vendorId}/ordersheets`;
  const params = {
    createdAtFrom,
    createdAtTo,
    maxPerPage: '50',
    status
  };
  
  return apiRequest('GET', path, params);
}

// Get all orders (all statuses)
async function getAllOrders(createdAtFrom, createdAtTo) {
  const statuses = ['ACCEPT', 'INSTRUCT', 'DEPARTURE', 'DELIVERING', 'FINAL_DELIVERY'];
  const allOrders = [];
  
  for (const status of statuses) {
    console.log(`Fetching ${status} orders...`);
    const result = await getOrdersByStatus(createdAtFrom, createdAtTo, status);
    
    if (result.status === 200 && result.data.code === 200) {
      const orders = result.data.data || [];
      console.log(`  Found ${orders.length} orders with status ${status}`);
      allOrders.push(...orders);
    } else {
      console.log(`  Error fetching ${status}:`, result.data.message || result.status);
    }
  }
  
  return allOrders;
}

// Map Coupang status to dashboard status
function mapStatus(coupangStatus) {
  const statusMap = {
    'ACCEPT': '결제완료',
    'INSTRUCT': '결제완료',
    'DEPARTURE': '배송중',
    'DELIVERING': '배송중',
    'FINAL_DELIVERY': '배송완료'
  };
  return statusMap[coupangStatus] || coupangStatus;
}

// Extract option from product name
function extractOption(productName) {
  if (productName.includes('DECAF') || productName.includes('디카페인')) return '시그니처 DECAF';
  if (productName.includes('HOUSE') || productName.includes('카페인')) return '카페인 HOUSE';
  if (productName.includes('VIBRANT') || productName.includes('스페셜티')) return '스페셜티 VIBRANT';
  return '일반 포장';
}

// Format datetime for sheet
function formatDateTime(isoString) {
  if (!isoString) return '';
  return isoString.replace('T', ' ').substring(0, 19);
}

// Transform Coupang order to sheet format
function transformOrder(order) {
  const item = order.orderItems[0] || {};
  const receiver = order.receiver || {};
  
  return {
    채널: 'coupang',
    주문번호: String(order.orderId),
    주문일시: formatDateTime(order.orderedAt),
    고객명: receiver.name || order.orderer?.name || '',
    상품명: 'LOCK IN COFFEE',
    옵션: extractOption(item.vendorItemPackageName || item.sellerProductName || ''),
    수량: item.shippingCount || 1,
    금액: item.orderPrice || 0,
    배송상태: mapStatus(order.status),
    택배사: order.deliveryCompanyName || '',
    운송장번호: order.invoiceNumber || '',
    주소: receiver.addr1 || '',
    상세주소: receiver.addr2 || '',
    배송메모: order.parcelPrintMessage || '',
    비고: ''
  };
}

// Get existing orders from sheet
function getExistingOrders() {
  try {
    const result = execSync(`gog sheets get "${SHEET_ID}" "시트1!A2:O200" --json 2>/dev/null`, { encoding: 'utf-8' });
    const data = JSON.parse(result);
    const existingIds = new Set();
    
    if (data.values) {
      data.values.forEach(row => {
        if (row[0] === 'coupang' && row[1]) {
          existingIds.add(row[1]);
        }
      });
    }
    
    return existingIds;
  } catch (e) {
    return new Set();
  }
}

// Append new orders to sheet
function appendOrders(orders) {
  if (orders.length === 0) {
    console.log('No new orders to add.');
    return;
  }
  
  const rows = orders.map(o => [
    o.채널, o.주문번호, o.주문일시, o.고객명, o.상품명, o.옵션,
    o.수량, o.금액, o.배송상태, o.택배사, o.운송장번호,
    o.주소, o.상세주소, o.배송메모, o.비고
  ]);
  
  const valuesJson = JSON.stringify(rows);
  
  try {
    execSync(`gog sheets append "${SHEET_ID}" "시트1!A:O" --values-json '${valuesJson}' --insert INSERT_ROWS 2>/dev/null`, { encoding: 'utf-8' });
    console.log(`✅ Added ${orders.length} new Coupang orders to sheet`);
  } catch (e) {
    console.error('Error appending to sheet:', e.message);
  }
}

// Main
async function main() {
  console.log('=== Coupang Order Sync ===\n');
  
  // Get orders from last 30 days (Coupang API limit: 32 days max)
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  
  const formatDate = (d) => d.toISOString().split('T')[0];
  
  console.log(`Period: ${formatDate(from)} ~ ${formatDate(to)}\n`);
  
  // Fetch all orders
  const coupangOrders = await getAllOrders(formatDate(from), formatDate(to));
  console.log(`\nTotal Coupang orders fetched: ${coupangOrders.length}`);
  
  // Get existing order IDs
  const existingIds = getExistingOrders();
  console.log(`Existing Coupang orders in sheet: ${existingIds.size}`);
  
  // Transform and filter new orders
  const transformed = coupangOrders.map(transformOrder);
  const newOrders = transformed.filter(o => !existingIds.has(o.주문번호));
  
  console.log(`New orders to add: ${newOrders.length}`);
  
  // Append new orders
  if (newOrders.length > 0) {
    appendOrders(newOrders);
    
    // Save for reference
    fs.writeFileSync('coupang-sync-result.json', JSON.stringify(newOrders, null, 2));
    console.log('Saved to coupang-sync-result.json');
  }
  
  console.log('\n✅ Coupang sync complete!');
}

main().catch(console.error);
