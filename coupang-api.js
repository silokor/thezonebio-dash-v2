const crypto = require('crypto');
const https = require('https');

// Coupang API Credentials
const CONFIG = {
  vendorId: 'A01543508',
  accessKey: '5ef5dee7-6ea8-4fd5-b163-d0a3a07898b6',
  secretKey: '156e04011d9a66efbd026af33ddf43c5ddcfeab7',
  host: 'api-gateway.coupang.com'
};

// Generate datetime in Coupang format (yyMMddTHHmmssZ)
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

    console.log('Request:', method, urlPath);
    console.log('Message for signature:', message);

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

// Get order list (발주서 목록 조회)
// status: ACCEPT(결제완료), INSTRUCT(발주확인), DEPARTURE(출고완료), DELIVERING(배송중), FINAL_DELIVERY(배송완료)
async function getOrders(createdAtFrom, createdAtTo, status = 'ACCEPT') {
  const path = `/v2/providers/openapi/apis/api/v4/vendors/${CONFIG.vendorId}/ordersheets`;
  const params = {
    createdAtFrom,
    createdAtTo,
    maxPerPage: '50',
    status
  };
  
  return apiRequest('GET', path, params);
}

// Main
async function main() {
  // Get orders from last 30 days
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  
  const formatDate = (d) => d.toISOString().split('T')[0];
  
  console.log(`\nFetching orders from ${formatDate(from)} to ${formatDate(to)}...\n`);
  
  const result = await getOrders(formatDate(from), formatDate(to));
  
  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.data, null, 2));
}

main().catch(console.error);
