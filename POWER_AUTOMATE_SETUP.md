# Power Automate 흐름 설정 가이드 (v3 - 완성본)
# 테이블: ECS_TBCRS_CAUSE_LIST | 데이터셋: VOC 대시보드 Ver2

## 확정된 정보 요약

| 항목 | 값 |
|------|-----|
| 데이터셋 | VOC 대시보드 Ver2 |
| 테이블명 | ECS_TBCRS_CAUSE_LIST |
| 협력사 컬럼 | 생산처명 |
| 날짜 컬럼 | 발생일자 |
| 불량유형 컬럼 | 상담대분류 |
| SharePoint 사이트 | https://pmoo365.sharepoint.com/sites/BI660 |
| SharePoint 폴더 | /Shared Documents/PQMS POWER BI/VOC 주간 리포트 |
| 저장 파일명 | weekly_summary.json |

---

## 흐름 전체 구성 (총 4단계)

```
[트리거: 매주 월요일 08:00]
         ↓
[STEP 1: Power BI - 전주 데이터 쿼리]
  ECS_TBCRS_CAUSE_LIST에서
  생산처명별 전주 VOC건수 + 주요 상담대분류
         ↓
[STEP 2: Power BI - 전전주 데이터 쿼리]
  생산처명별 전전주 VOC건수 (전주비 계산용)
         ↓
[STEP 3: Compose - JSON 조립]
  두 쿼리 결과 합쳐서 weekly_summary.json 형성
         ↓
[STEP 4: SharePoint - 파일 저장/업데이트]
```

---

## STEP 1: 트리거 (Recurrence)

- 흐름 이름: `PQMS 주간 VOC 자동 분석`
- 시작: 2026-09-14 (다음 월요일)
- 반복: 1주, 월요일, 오전 08:00 (KST = UTC+9이므로 UTC 기준 23:00 일요일)

---

## STEP 2: Power BI 쿼리 1 - 전주 데이터

[+ 새 단계] → Power BI → "데이터 세트에 대해 쿼리 실행"

- 작업 영역: `PQMS BI 개발_Fabric`
- 데이터 세트: `VOC 대시보드 Ver2`
- 쿼리 유형: `DAX`
- DAX 쿼리: (아래 전체 복사)

```dax
DEFINE
  VAR _prevWeekSun = TODAY() - WEEKDAY(TODAY(), 2)
  VAR _prevWeekMon = _prevWeekSun - 6

EVALUATE
SUMMARIZECOLUMNS(
  'ECS_TBCRS_CAUSE_LIST'[생산처명],
  FILTER(
    ALL('ECS_TBCRS_CAUSE_LIST'),
    'ECS_TBCRS_CAUSE_LIST'[발생일자] >= _prevWeekMon &&
    'ECS_TBCRS_CAUSE_LIST'[발생일자] <= _prevWeekSun
  ),
  "전주_VOC건수", COUNTROWS('ECS_TBCRS_CAUSE_LIST'),
  "주요_상담대분류",
    MAXX(
      TOPN(
        1,
        SUMMARIZE(
          'ECS_TBCRS_CAUSE_LIST',
          'ECS_TBCRS_CAUSE_LIST'[상담대분류],
          "건수", COUNTROWS('ECS_TBCRS_CAUSE_LIST')
        ),
        [건수], DESC
      ),
      'ECS_TBCRS_CAUSE_LIST'[상담대분류]
    )
)
ORDER BY [전주_VOC건수] DESC
```

---

## STEP 3: Power BI 쿼리 2 - 전전주 데이터 (전주비 계산용)

[+ 새 단계] → Power BI → "데이터 세트에 대해 쿼리 실행"

- 동일한 작업 영역 / 데이터 세트
- DAX 쿼리:

```dax
DEFINE
  VAR _prevWeekSun  = TODAY() - WEEKDAY(TODAY(), 2)
  VAR _prevWeekMon  = _prevWeekSun - 6
  VAR _prev2WeekSun = _prevWeekMon - 1
  VAR _prev2WeekMon = _prev2WeekSun - 6

EVALUATE
SUMMARIZECOLUMNS(
  'ECS_TBCRS_CAUSE_LIST'[생산처명],
  FILTER(
    ALL('ECS_TBCRS_CAUSE_LIST'),
    'ECS_TBCRS_CAUSE_LIST'[발생일자] >= _prev2WeekMon &&
    'ECS_TBCRS_CAUSE_LIST'[발생일자] <= _prev2WeekSun
  ),
  "전전주_VOC건수", COUNTROWS('ECS_TBCRS_CAUSE_LIST')
)
```

---

## STEP 4: Compose - JSON 조립

[+ 새 단계] → "작성(Compose)"

아래 내용 입력 (Power Automate 동적 콘텐츠 삽입):

```
{
  "updated_at": "@{formatDateTime(utcNow(), 'yyyy-MM-dd')}",
  "week_label": "@{concat(formatDateTime(addDays(utcNow(),-7),'yy'), '년 ', string(div(add(dayOfYear(addDays(utcNow(),-7)),6),7)), '주차')}",
  "data_period": "@{formatDateTime(addDays(utcNow(),-13),'yyyy-MM-dd')} ~ @{formatDateTime(addDays(utcNow(),-7),'yyyy-MM-dd')}",
  "note": "Power Automate 자동 갱신 - 매주 월요일 08:00",
  "prev_week_data": @{body('데이터_집합에_대해_쿼리_실행')?['results']?[0]?['tables']?[0]?['rows']},
  "prev2_week_data": @{body('데이터_집합에_대해_쿼리_실행_2')?['results']?[0]?['tables']?[0]?['rows']}
}
```

> ⚠️ 액션명 주의: Power Automate 화면에서 실제 생성된 이름은 **`데이터_집합에_대해_쿼리_실행`** 입니다 (`세트` ❌ → `집합` ✅)

※ `body()` 안의 액션명은 실제 Power Automate에서 자동 생성되는 이름으로 변경

---

## STEP 5: SharePoint 파일 저장

[+ 새 단계] → SharePoint → "파일 만들기"

- 사이트 주소: `https://pmoo365.sharepoint.com/sites/BI660`
- 폴더 경로: `/Shared Documents/PQMS POWER BI/VOC 주간 리포트`
- 파일 이름: `weekly_summary.json`
- 파일 콘텐츠: `@{outputs('작성')}` (Compose 결과)

> 파일이 이미 있는 경우 오류 발생 시:
> - 조건(Condition)을 추가하여 파일 존재 여부를 확인 후 "파일 업데이트" 액션 사용
> - 또는 매주 덮어쓰기 위해 삭제 → 생성 방식으로 구성

---

## index.html 동적 로드 구조 (이미 적용 완료)

```
[SharePoint에 weekly_summary.json 저장됨]
              ↓
[GitHub에도 동일 파일 복사 필요]
   (GitHub Pages는 SharePoint 직접 접근 불가)
              ↓
[index.html → fetch('./data/weekly_summary.json')]
              ↓
[16개 카드 자동 갱신]
```

### GitHub 자동 복사 방법 (선택사항)

STEP 5 이후 추가 단계:

[+ 새 단계] → "HTTP" → HTTP 요청 전송

- 메서드: PUT
- URI: `https://api.github.com/repos/lloowee86-hue/BI-Dashboard/contents/data/weekly_summary.json`
- 헤더:
  ```
  Authorization: Bearer [GitHub Personal Access Token]
  Content-Type: application/json
  ```
- 본문:
  ```json
  {
    "message": "Auto: @{formatDateTime(utcNow(), 'yyyy-MM-dd')} 주간 VOC 데이터 갱신",
    "content": "@{base64(outputs('작성'))}",
    "sha": "[기존 파일 SHA 값, 파일 조회 후 획득]"
  }
  ```

---

## 테스트 체크리스트

- [ ] 흐름 저장
- [ ] [테스트] → [수동으로] 클릭
- [ ] STEP 2 결과에서 생산처명 컬럼 확인
- [ ] STEP 3 결과에서 전전주 데이터 확인
- [ ] SharePoint 폴더에 weekly_summary.json 파일 생성 확인
- [ ] 파일 내용이 올바른 JSON 구조인지 검토
