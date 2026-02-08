const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = '1Uu9Tv1L6TfxHgW44v3hvB1_yz-HHYcMINP_Jhdi9G6s';

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
