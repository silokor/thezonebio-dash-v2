const { execSync } = require('child_process');
const fs = require('fs');

const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';
const ACCOUNT = 'silokor17@gmail.com';

// Load cafe24 data
const cafe24Data = JSON.parse(fs.readFileSync('./cafe24-full-orders.json', 'utf8'));
const cafe24Map = {};
cafe24Data.forEach(o => {
  cafe24Map[o.order_id] = o;
});

// Get sheet data
console.log('Fetching sheet data...');
const sheetJson = execSync(`gog sheets get "${SHEET_ID}" "시트1!A:Q" --json --account ${ACCOUNT} 2>/dev/null`).toString();
const sheetData = JSON.parse(sheetJson);
const rows = sheetData.values;

console.log(`Found ${rows.length} rows in sheet`);

// Find cafe24 rows and update
const updates = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const channel = row[0];
  const orderId = row[1];
  
  if (channel === 'cafe24' && cafe24Map[orderId]) {
    const data = cafe24Map[orderId];
    const rowNum = i + 1; // 1-indexed
    
    // Update columns: E(상품), F(옵션), P(전화번호), Q(우편번호)
    // Also update L(주소), M(상세주소)
    updates.push({
      rowNum,
      orderId,
      phone: data.phone,
      zipcode: data.zipcode,
      product: data.product.substring(0, 100),
      option: data.option.substring(0, 100),
      address: data.address,
      address2: data.address2
    });
  }
}

console.log(`\nFound ${updates.length} cafe24 orders to update\n`);

// Execute updates
for (const u of updates) {
  console.log(`Updating row ${u.rowNum}: ${u.orderId}`);
  
  // Update phone & zipcode (P, Q)
  const pqValues = JSON.stringify([[u.phone, u.zipcode]]);
  execSync(`gog sheets update "${SHEET_ID}" "시트1!P${u.rowNum}:Q${u.rowNum}" --values-json '${pqValues}' --input USER_ENTERED --account ${ACCOUNT} 2>/dev/null`);
  
  // Update product & option (E, F)
  const efValues = JSON.stringify([[u.product, u.option]]);
  execSync(`gog sheets update "${SHEET_ID}" "시트1!E${u.rowNum}:F${u.rowNum}" --values-json '${efValues}' --input USER_ENTERED --account ${ACCOUNT} 2>/dev/null`);
  
  // Update address (L, M) if available
  if (u.address) {
    const lmValues = JSON.stringify([[u.address, u.address2 || '']]);
    execSync(`gog sheets update "${SHEET_ID}" "시트1!L${u.rowNum}:M${u.rowNum}" --values-json '${lmValues}' --input USER_ENTERED --account ${ACCOUNT} 2>/dev/null`);
  }
}

console.log('\n✅ Sheet update complete!');
