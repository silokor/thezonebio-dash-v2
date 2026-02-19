const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '12whpVCNHRvOwQWXotAs6CzRWbQVT44JhD95kSo3je0I';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(process.env.HOME, '.config/gcloud/application_default_credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // 현재 헤더 확인
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '시트1!1:1'
  });
  
  console.log('현재 헤더:', res.data.values[0]);
  console.log('컬럼 수:', res.data.values[0].length);
}

main().catch(console.error);
