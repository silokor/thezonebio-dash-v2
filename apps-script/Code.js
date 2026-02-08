function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById('1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s');
  
  if (data.action === 'updateStatus') {
    const sheet = ss.getSheetByName('시트1');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(data.orderId)) {
        sheet.getRange(i + 1, 9).setValue(data.status);
        return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  
  if (data.action === 'updateInventory') {
    const sheet = ss.getSheetByName('재고');
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === data.item) {
        sheet.getRange(i + 1, 2).setValue(data.quantity);
        sheet.getRange(i + 1, 5).setValue(new Date().toISOString().split('T')[0]);
        const status = data.quantity <= 0 ? '품절' : data.quantity <= 3 ? '부족' : '정상';
        sheet.getRange(i + 1, 4).setValue(status);
        return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({success: false})).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', message: '더존바이오 대시보드 API'})).setMimeType(ContentService.MimeType.JSON);
}
