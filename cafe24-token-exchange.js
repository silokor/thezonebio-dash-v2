const https = require('https');

const CLIENT_ID = 'WnsgQ0XnLZdiCCRf6cZrVG';
const CLIENT_SECRET = 'CmqyTtIgJ9WqKP1iAm2blA';
const AUTH_CODE = 'qopvlnBeUyaN9t8MwTHrbA';
const REDIRECT_URI = 'https://thezonebio-dash-v2.vercel.app/callback';
const MALL_ID = 'thezonebio';

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

const postData = new URLSearchParams({
  grant_type: 'authorization_code',
  code: AUTH_CODE,
  redirect_uri: REDIRECT_URI
}).toString();

const options = {
  hostname: `${MALL_ID}.cafe24api.com`,
  port: 443,
  path: '/api/v2/oauth/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${credentials}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    try {
      const json = JSON.parse(data);
      console.log('\n=== Token Info ===');
      console.log('Access Token:', json.access_token);
      console.log('Refresh Token:', json.refresh_token);
      console.log('Expires In:', json.expires_in);
      console.log('Scope:', json.scope);
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
