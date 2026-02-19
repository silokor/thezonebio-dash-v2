function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  return processRequest(data);
}

function doGet(e) {
  const params = e.parameter;
  if (params.action) {
    return processRequest(params);
  }
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', message: '더존바이오 대시보드 API'})).setMimeType(ContentService.MimeType.JSON);
}

function processRequest(data) {
  const ss = SpreadsheetApp.openById('12whpVCNHRvOwQWXotAs6CzRWbQVT44JhD95kSo3je0I');
  
  // ─────────────────────────────────────────────
  // append: 새 주문 추가
  // ─────────────────────────────────────────────
  if (data.action === 'append') {
    const sheet = ss.getSheetByName('Sheet1');
    const values = sheet.getDataRange().getValues();
    
    // 중복 체크 (주문번호 기준)
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(data.orderId)) {
        return ContentService.createTextOutput(JSON.stringify({success: false, message: '중복 주문번호'})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 컬럼 순서: 채널, 주문번호, 주문일시, 고객명, 전화번호, 우편번호, 주소, 상세주소, 상품명, 옵션, 수량, 금액, 배송상태, 택배사, 운송장번호, 배송메모, 비고
    const row = [
      data.channel || '',
      data.orderId || '',
      data.orderDate || '',
      data.customerName || '',
      data.phone || '',
      data.zipcode || '',
      data.address || '',
      data.addressDetail || '',
      data.productName || '',
      data.option || '',
      data.quantity || '',
      data.amount || '',
      data.status || '결제완료',
      data.courier || '',
      data.trackingNumber || '',
      data.deliveryMemo || '',
      data.note || ''
    ];
    
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({success: true, orderId: data.orderId})).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ─────────────────────────────────────────────
  // updateStatus: 배송상태 업데이트
  // ─────────────────────────────────────────────
  if (data.action === 'updateStatus') {
    const sheet = ss.getSheetByName('Sheet1');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(data.orderId)) {
        sheet.getRange(i + 1, 13).setValue(data.status);
        return ContentService.createTextOutput(JSON.stringify({success: true, orderId: data.orderId, status: data.status})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Order not found'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  // ─────────────────────────────────────────────
  // updateInventory: 재고 업데이트
  // ─────────────────────────────────────────────
  if (data.action === 'updateInventory') {
    const sheet = ss.getSheetByName('재고');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.item) {
        sheet.getRange(i + 1, 2).setValue(Number(data.quantity));
        sheet.getRange(i + 1, 5).setValue(new Date().toISOString().split('T')[0]);
        const status = Number(data.quantity) <= 0 ? '품절' : Number(data.quantity) <= 3 ? '부족' : '정상';
        sheet.getRange(i + 1, 4).setValue(status);
        return ContentService.createTextOutput(JSON.stringify({success: true, item: data.item, quantity: data.quantity})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Item not found'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Unknown action'})).setMimeType(ContentService.MimeType.JSON);
}
