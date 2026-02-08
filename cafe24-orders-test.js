const https = require('https');

const ACCESS_TOKEN = 'GhfwDTXISqLcDPMdhI7ucE';
const MALL_ID = 'thezonebio';

// Last 30 days
const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

const options = {
  hostname: `${MALL_ID}.cafe24api.com`,
  port: 443,
  path: `/api/v2/admin/orders?limit=20&start_date=${startDate}&end_date=${endDate}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Cafe24-Api-Version': '2025-12-01'
  }
};

console.log('Fetching orders from', startDate, 'to', endDate);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('\n=== Orders ===');
      if (json.orders) {
        console.log('Total orders returned:', json.orders.length);
        json.orders.forEach((order, i) => {
          console.log(`\n[${i+1}] Order ID: ${order.order_id}`);
          console.log('    Date:', order.order_date);
          console.log('    Customer:', order.buyer_name);
          console.log('    Status:', order.order_status);
        });
        // Save to file
        require('fs').writeFileSync('cafe24-orders-latest.json', JSON.stringify(json, null, 2));
        console.log('\nSaved to cafe24-orders-latest.json');
      } else {
        console.log('Response:', JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();
