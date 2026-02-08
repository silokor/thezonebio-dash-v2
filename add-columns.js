const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/tmp/sheet-data.json', 'utf-8'));

// 기존 12컬럼 → 새 15컬럼 (주소, 상세주소, 배송메모 추가, 비고는 맨 뒤로)
// 기존: 채널,주문번호,주문일시,고객명,상품명,옵션,수량,금액,배송상태,택배사,운송장번호,비고
// 새:   채널,주문번호,주문일시,고객명,상품명,옵션,수량,금액,배송상태,택배사,운송장번호,주소,상세주소,배송메모,비고

const newValues = data.values.map((row, idx) => {
  if (idx === 0) {
    // 헤더 행
    return [
      '채널', '주문번호', '주문일시', '고객명', '상품명', '옵션', 
      '수량', '금액', '배송상태', '택배사', '운송장번호', 
      '주소', '상세주소', '배송메모', '비고'
    ];
  }
  
  // 데이터 행
  const base = row.slice(0, 11); // A~K (채널~운송장번호)
  const note = row[11] || '';    // L (기존 비고)
  
  // 15컬럼으로 확장
  return [
    ...base,
    '',      // 주소 (L)
    '',      // 상세주소 (M)
    '',      // 배송메모 (N)
    note     // 비고 (O)
  ];
});

console.log(JSON.stringify(newValues, null, 2));
