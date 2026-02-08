#!/usr/bin/env node
// 시트 구조 변경: 옵션 컬럼 추가 + 날짜 내림차순 정렬

const currentData = [
  ["naver", "2026020818294371", "2026-02-08 01:16:09", "김현자", "LOCK IN 락인 커피 디카페인 버섯커피 원액 500ml", "2", "78000", "결제완료", "", "", "신규주문"],
  ["coupang", "9100169436908", "2026-02-05 17:52:00", "황진우", "[시그니처 DECAF] 더존바이오 버섯커피", "1", "59000", "결제완료", "", "", ""],
  ["coupang", "15100169525949", "2026-02-03 23:39:00", "김경춘", "[시그니처 DECAF] 더존바이오 버섯커피", "1", "59000", "결제완료", "", "", "출고지연"],
  ["naver", "2026013166098201", "2026-01-31 17:11:40", "백강후", "LOCK IN COFFEE::DECAF", "1", "59000", "배송완료", "", "", ""],
  ["coupang", "9100167318633", "2026-01-26 09:34:00", "황진우", "[카페인 HOUSE] 더존바이오 버섯커피", "1", "59000", "배송완료", "롯데택배", "409692304792", ""],
  ["naver", "2026012591077971", "2026-01-25 12:42:22", "김영민", "LOCK IN COFFEE::HOUSE", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260123-0000048", "2026-01-23 16:58:11", "Sam Kim", "LOCK IN COFFEE::VIBRANT 외 2건", "3", "207000", "배송중", "", "", ""],
  ["naver", "2026012078092501", "2026-01-20 04:57:36", "김현자", "[1+1 EVENT] LOCK IN COFFEE", "1", "69900", "구매확정", "", "", ""],
  ["cafe24", "20260114-0000012", "2026-01-14 21:22:33", "정소영", "[1+1 EVENT] LOCK IN COFFEE", "1", "69900", "배송중", "", "", ""],
  ["naver", "2026011247040711", "2026-01-12 13:16:24", "조솔미", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260109-0000055", "2026-01-09 23:20:23", "이호중", "[1+1 EVENT] LOCK IN COFFEE", "1", "66900", "배송완료", "", "", "쿠폰"],
  ["cafe24", "20260109-0000023", "2026-01-09 14:11:42", "유한나", "[1+1 EVENT] LOCK IN COFFEE", "1", "69900", "배송완료", "", "", ""],
  ["cafe24", "20260109-0000014", "2026-01-09 14:00:36", "유한나", "LOCK IN COFFEE::DECAF", "1", "0", "취소", "", "", ""],
  ["naver", "2026010916923511", "2026-01-09 06:29:23", "최진주", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260108-0000021", "2026-01-08 21:30:35", "안세원", "[1+1 EVENT] LOCK IN COFFEE", "1", "66900", "배송완료", "", "", "쿠폰"],
  ["cafe24", "20260108-0000017", "2026-01-08 20:06:52", "문정훈", "[1+1 EVENT] LOCK IN COFFEE", "1", "66900", "배송완료", "", "", "쿠폰"],
  ["naver", "2026010758091501", "2026-01-07 22:43:43", "김태은", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260107-0000024", "2026-01-07 22:10:24", "김예선", "LOCK IN COFFEE::DECAF", "1", "55200", "배송완료", "", "", ""],
  ["naver", "2026010750243121", "2026-01-07 19:30:46", "김인혜", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["naver", "2026010749608821", "2026-01-07 19:12:22", "강선이", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["naver", "2026010747570531", "2026-01-07 18:10:31", "박은경", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260107-0000012", "2026-01-07 00:08:39", "김기환", "[1+1 EVENT] LOCK IN COFFEE", "1", "69900", "배송완료", "", "", ""],
  ["naver", "2026010557183961", "2026-01-05 22:01:20", "이현미", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["naver", "2026010536002581", "2026-01-05 13:43:54", "서미희", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20260103-0000013", "2026-01-03 09:25:12", "박양희", "[1+1 EVENT] LOCK IN COFFEE", "1", "69900", "배송완료", "", "", ""],
  ["cafe24", "20251231-0000019", "2025-12-31 02:37:51", "정교윤", "LOCK IN COFFEE::DECAF", "1", "55200", "배송완료", "", "", ""],
  ["cafe24", "20251229-0000011", "2025-12-29 13:15:38", "황진우", "LOCK IN COFFEE::DECAF", "1", "55200", "배송완료", "", "", ""],
  ["cafe24", "20251227-0000011", "2025-12-27 17:11:18", "김규리", "LOCK IN COFFEE::VIBRANT 외 1건", "2", "220800", "배송완료", "", "", ""],
  ["cafe24", "20251216-0000011", "2025-12-16 12:16:30", "김은영", "LOCK IN COFFEE::DECAF", "1", "55200", "배송완료", "", "", ""],
  ["cafe24", "20251214-0000012", "2025-12-14 11:12:01", "김경은", "LOCK IN COFFEE::DECAF", "1", "110400", "배송완료", "", "", ""],
  ["cafe24", "20251211-0000019", "2025-12-11 10:26:19", "손예준", "LOCK IN COFFEE::VIBRANT 외 1건", "2", "96600", "배송완료", "", "", ""],
  ["naver", "2025120727213991", "2025-12-07 20:11:22", "박준영", "LOCK IN COFFEE::DECAF", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20251203-0000010", "2025-12-03 23:31:26", "김규리", "LOCK IN COFFEE::VIBRANT 외 1건", "2", "207200", "배송완료", "", "", ""],
  ["cafe24", "20251127-0000012", "2025-11-27 17:39:38", "김도형", "[Family & Friends] LOCK IN COFFEE", "1", "96600", "배송완료", "", "", ""],
  ["naver", "2025112788877491", "2025-11-27 10:33:21", "권규리", "LOCK IN COFFEE::HOUSE", "1", "59000", "구매확정", "", "", ""],
  ["cafe24", "20251125-0000019", "2025-11-25 10:13:27", "김도형", "LOCK IN COFFEE::VIBRANT", "1", "0", "취소", "", "", ""],
  ["cafe24", "20251119-0000013", "2025-11-19 14:30:40", "김진호", "LOCK IN COFFEE::DECAF", "1", "69000", "배송완료", "", "", ""],
];

// Naver 옵션 매핑 (스크랩 데이터에서)
const naverOptions = {
  "2026020818294371": "일반 포장",
  "2026013166098201": "일반 포장",
  "2026012591077971": "카페인 HOUSE",
  "2026012078092501": "HOUSE + DECAF",
  "2026011247040711": "시그니처 DECAF",
  "2026010916923511": "시그니처 DECAF",
  "2026010758091501": "시그니처 DECAF",
  "2026010750243121": "시그니처 DECAF",
  "2026010749608821": "시그니처 DECAF",
  "2026010747570531": "시그니처 DECAF",
  "2026010557183961": "시그니처 DECAF",
  "2026010536002581": "시그니처 DECAF",
  "2025120727213991": "시그니처 DECAF",
  "2025112788877491": "카페인 HOUSE",
};

function extractOption(row) {
  const [channel, orderId, , , productName] = row;
  
  // Naver 매핑 확인
  if (channel === 'naver' && naverOptions[orderId]) {
    return naverOptions[orderId];
  }
  
  // Coupang - 상품명에서 추출
  if (productName.includes('[시그니처 DECAF]')) return '시그니처 DECAF';
  if (productName.includes('[카페인 HOUSE]')) return '카페인 HOUSE';
  
  // Cafe24/일반 - 상품명 패턴에서 추출
  if (productName.includes('::DECAF')) return '시그니처 DECAF';
  if (productName.includes('::HOUSE')) return '카페인 HOUSE';
  if (productName.includes('::VIBRANT')) return '바이브런트 VIBRANT';
  if (productName.includes('[1+1 EVENT]')) return '1+1 이벤트';
  if (productName.includes('[Family & Friends]')) return 'F&F 패키지';
  if (productName.includes('디카페인')) return '시그니처 DECAF';
  
  return '-';
}

function cleanProductName(name) {
  return name
    .replace(/::DECAF|::HOUSE|::VIBRANT/g, '')
    .replace(/\[시그니처 DECAF\]|\[카페인 HOUSE\]/g, '')
    .replace(/\[1\+1 EVENT\]|\[Family & Friends\]/g, '')
    .replace(/LOCK IN 락인 커피 디카페인 버섯커피 원액 500ml/g, 'LOCK IN COFFEE')
    .replace(/더존바이오 버섯커피/g, 'LOCK IN COFFEE')
    .replace(/\s+/g, ' ')
    .trim();
}

// 새 구조로 변환: 채널, 주문번호, 주문일시, 고객명, 상품명, 옵션, 수량, 금액, 배송상태, 택배사, 운송장번호, 비고
const newData = currentData.map(row => {
  const [channel, orderId, orderDate, customer, productName, qty, amount, status, courier, tracking, note] = row;
  const option = extractOption(row);
  const cleanName = cleanProductName(productName);
  
  return [channel, orderId, orderDate, customer, cleanName, option, qty, amount, status, courier || '', tracking || '', note || ''];
});

// 날짜 내림차순 정렬
newData.sort((a, b) => {
  const dateA = new Date(a[2].replace(' ', 'T'));
  const dateB = new Date(b[2].replace(' ', 'T'));
  return dateB - dateA;
});

// 헤더
const header = ['채널', '주문번호', '주문일시', '고객명', '상품명', '옵션', '수량', '금액', '배송상태', '택배사', '운송장번호', '비고'];

// TSV 출력 (gog sheets update용)
console.log('=== NEW HEADER ===');
console.log(header.join('\t'));
console.log('\n=== SORTED DATA ===');
newData.forEach((row, i) => {
  console.log(`${i+1}. ${row[2]} | ${row[3]} | ${row[5]}`);
});

// JSON 출력
const output = [header, ...newData];
require('fs').writeFileSync('sheet-data-new.json', JSON.stringify(output, null, 2));
console.log('\n✓ Saved to sheet-data-new.json');
