// Google Apps Script - 이 코드를 시트의 Apps Script에 붙여넣기
// 확장 프로그램 > Apps Script > 코드 붙여넣기 > 배포 > 웹앱 (누구나 접근)

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const orderId = data.orderId;
    const newStatus = data.status;
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시트1');
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // 주문번호로 행 찾기 (B열 = index 1)
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(orderId)) {
        // I열 (index 8) = 배송상태
        sheet.getRange(i + 1, 9).setValue(newStatus);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: `주문 ${orderId} 상태가 ${newStatus}로 변경되었습니다.`
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: '주문을 찾을 수 없습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: '더존바이오 대시보드 API'
  })).setMimeType(ContentService.MimeType.JSON);
}
