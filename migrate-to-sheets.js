#!/usr/bin/env node
const { execSync } = require('child_process');

const SHEET_ID = '12whpVCNHRvOwQWXotAs6CzRWbQVT44JhD95kSo3je0I';
const GOG_ACCOUNT = 'silokor17@gmail.com';

// Load data
const cafe24 = require('./data/cafe24/orders.json');
const naverData = require('./data/naver/orders.json');
const coupangData = require('./data/coupang/orders.json');

const rows = [];

// Cafe24
cafe24.forEach(o => {
  let status = o.shippingStatus;
  if (status === '취소') status = '취소';
  else if (status === '배송완료') status = '배송완료';
  else if (status === '배송중') status = '배송중';
  else status = '결제완료';
  
  rows.push([
    'cafe24',
    o.orderId,
    o.orderDate,
    o.customerName,
    o.productName,
    o.shippingCount || 1,
    o.paymentAmount,
    status,
    '',
    '',
    o.discountType || ''
  ]);
});

// Naver - orders
naverData.orders.forEach(o => {
  let status = o.status;
  if (status === '구매확정') status = '배송완료';
  
  rows.push([
    'naver',
    o.orderId,
    o.orderDate,
    o.customerName,
    o.productName,
    o.quantity || 1,
    o.amount,
    status,
    '',
    '',
    ''
  ]);
});

// Naver - cancelled
naverData.cancelled.forEach(o => {
  rows.push([
    'naver',
    o.orderId,
    o.orderDate,
    o.customerName,
    '',
    0,
    0,
    '취소',
    '',
    '',
    ''
  ]);
});

// Coupang
coupangData.orders.forEach(o => {
  rows.push([
    'coupang',
    o.orderId,
    o.orderDate,
    o.customerName,
    o.productName,
    o.quantity || 1,
    o.amount,
    o.status,
    o.courier || '',
    o.trackingNumber || '',
    o.note || ''
  ]);
});

// Sort by date descending
rows.sort((a, b) => new Date(b[2]) - new Date(a[2]));

console.log(`Total rows: ${rows.length}`);
console.log(JSON.stringify(rows, null, 2));

// Output for gog
const jsonStr = JSON.stringify(rows);
console.log('\n--- JSON for gog ---\n');
console.log(jsonStr);
