/**
 * 3채널 자동 동기화 (Coupang + Cafe24 + Naver)
 * Apps Script에서 1시간마다 실행
 */

const CONFIG = {
  SHEET_ID: '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s',
  SHEET_NAME: '시트1',
  COUPANG: {
    ACCESS_KEY: '5ef5dee7-6ea8-4fd5-b163-d0a3a07898b6',
    SECRET_KEY: '156e04011d9a66efbd026af33ddf43c5ddcfeab7',
    VENDOR_ID: 'A01543508'
  },
  CAFE24: {
    CLIENT_ID: 'WnsgQ0XnLZdiCCRf6cZrVG',
    CLIENT_SECRET: 'CmqyTtIgJ9WqKP1iAm2blA',
    MALL_ID: 'thezonebio'
  },
  NAVER: {
    CLIENT_ID: '34TOeMTHVvJqeYcSqm7Rmh',
    CLIENT_SECRET: '$2a$04$E8IpO.Nw.edgzTqtfn09Ve'
  }
};

function syncAll() {
  console.log('3채널 동기화 시작');
  try { syncCoupang(); } catch(e) { console.error('쿠팡:', e); }
  try { syncCafe24(); } catch(e) { console.error('카페24:', e); }
  try { syncNaver(); } catch(e) { console.error('네이버:', e); }
  console.log('동기화 완료');
}

function syncCoupang() {
  const path = '/v2/providers/openapi/apis/api/v4/vendors/' + CONFIG.COUPANG.VENDOR_ID + '/ordersheets';
  const ts = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(ts + 'GET' + path, CONFIG.COUPANG.SECRET_KEY));
  const url = 'https://api-gateway.coupang.com' + path + '?createdAtFrom=' + getDateAgo(7) + '&createdAtTo=' + getToday() + '&status=ACCEPT';
  const r = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'CEA algorithm=HmacSHA256, access-key=' + CONFIG.COUPANG.ACCESS_KEY + ', signed-date=' + ts + ', signature=' + sig },
    muteHttpExceptions: true
  });
  const d = JSON.parse(r.getContentText());
  (d.data || []).forEach(function(o) {
    addOrder('coupang', o.orderId, o.orderedAt, o.receiver && o.receiver.name, o.orderItems && o.orderItems[0] && o.orderItems[0].vendorItemName, o.orderItems && o.orderItems[0] && o.orderItems[0].shippingCount, o.orderItems && o.orderItems[0] && o.orderItems[0].orderPrice, o.receiver && o.receiver.addr1, o.receiver && o.receiver.postCode, o.receiver && o.receiver.safeNumber);
  });
}

function syncCafe24() {
  var tk = getCafe24Token();
  if (!tk) tk = refreshCafe24Token();
  var url = 'https://' + CONFIG.CAFE24.MALL_ID + '.cafe24api.com/api/v2/admin/orders?start_date=' + getDateAgo(7) + '&end_date=' + getToday();
  var r = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + tk, 'X-Cafe24-Api-Version': '2024-03-01' },
    muteHttpExceptions: true
  });
  var d = JSON.parse(r.getContentText());
  (d.orders || []).forEach(function(o) {
    addOrder('cafe24', o.order_id, o.order_date, o.buyer_name, o.items && o.items[0] && o.items[0].product_name, o.items && o.items[0] && o.items[0].quantity, o.actual_order_amount && o.actual_order_amount.total_amount_due, o.shipping_address, o.shipping_zipcode, o.buyer_phone);
  });
}

function getCafe24Token() {
  var p = PropertiesService.getScriptProperties().getProperty('CAFE24_TOKEN');
  if (!p) return null;
  var d = JSON.parse(p);
  return new Date() < new Date(d.expiresAt) ? d.accessToken : null;
}

function refreshCafe24Token() {
  var p = PropertiesService.getScriptProperties().getProperty('CAFE24_TOKEN');
  if (!p) throw new Error('setCafe24InitialToken 먼저 실행');
  var rt = JSON.parse(p).refreshToken;
  var r = UrlFetchApp.fetch('https://' + CONFIG.CAFE24.MALL_ID + '.cafe24api.com/api/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.CAFE24.CLIENT_ID + ':' + CONFIG.CAFE24.CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: 'grant_type=refresh_token&refresh_token=' + rt,
    muteHttpExceptions: true
  });
  var d = JSON.parse(r.getContentText());
  if (d.error) throw new Error(d.error);
  PropertiesService.getScriptProperties().setProperty('CAFE24_TOKEN', JSON.stringify({
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiresAt: new Date(Date.now() + d.expires_in * 1000).toISOString()
  }));
  return d.access_token;
}

function setCafe24InitialToken() {
  PropertiesService.getScriptProperties().setProperty('CAFE24_TOKEN', JSON.stringify({
    accessToken: 'YT2SodhvN1PpLh2Fet7evJ',
    refreshToken: 'dfLCy8cOSa2PJIzz5I1ZFD',
    expiresAt: '2026-02-11T01:13:25.000Z'
  }));
  console.log('Cafe24 토큰 설정 완료');
}

function syncNaver() {
  var ts = Date.now();
  var pw = CONFIG.NAVER.CLIENT_ID + '_' + ts;
  var sig = Utilities.base64Encode(BCRYPT.hashSync(pw, CONFIG.NAVER.CLIENT_SECRET));
  var r = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    payload: 'client_id=' + CONFIG.NAVER.CLIENT_ID + '&timestamp=' + ts + '&client_secret_sign=' + encodeURIComponent(sig) + '&grant_type=client_credentials&type=SELF',
    muteHttpExceptions: true
  });
  var tk = JSON.parse(r.getContentText()).access_token;
  if (!tk) throw new Error('Naver token failed');
  var r2 = UrlFetchApp.fetch('https://api.commerce.naver.com/external/v1/pay-order/seller/orders?orderSearchType=PAYED&rangeSearchType=PAYED_DATE&startDate=' + getDateAgo(7) + '&endDate=' + getToday(), {
    headers: { 'Authorization': 'Bearer ' + tk },
    muteHttpExceptions: true
  });
  (JSON.parse(r2.getContentText()).data || []).forEach(function(o) {
    addOrder('naver', o.productOrderId, o.paymentDate, o.ordererName, o.productName, o.quantity, o.totalPaymentAmount, o.shippingAddress && o.shippingAddress.baseAddress, o.shippingAddress && o.shippingAddress.zipcode, o.ordererTel);
  });
}

function addOrder(ch, id, dt, nm, prod, qty, amt, addr, zip, ph) {
  var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  if (sh.getRange('B:B').getValues().flat().includes(String(id))) return;
  sh.appendRow([ch, id, dt, nm, prod, '일반 포장', qty || 1, amt || 0, '결제완료', '', '', addr || '', '', '', '', ph || '', zip || '']);
}

function getToday() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
}

function getDateAgo(d) {
  var dt = new Date();
  dt.setDate(dt.getDate() - d);
  return Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd');
}
