# pERK Western blot troubleshooting 기록

- 작성자: 최현우
- 최근 수정: 2026-06-18
- 적용 범위: 0.45 μm PVDF wet transfer 및 HRP-ECL 검출

## 1. 전체 밴드가 약하게 보임

### 관찰

- Marker transfer는 보이지만 모든 sample lane의 pERK 및 total ERK 신호가 함께 약하다.
- 노출 시간을 늘려도 signal-to-background 비율이 거의 개선되지 않는다.

### 가능한 원인

1. Cassette 방향 오류 또는 gel-membrane 사이 기포
2. Transfer buffer가 충분히 차갑지 않음
3. Ice pack 교체 누락으로 후반부 tank 온도 상승
4. ECL 혼합 직후 사용하지 않음

### 확인 순서

1. Primary 농도를 높이기 전에 Ponceau S 이미지를 확인한다.
2. Lane 단위의 빈 영역이 있으면 기포 위치와 대조한다.
3. Transfer 시작·종료 시각과 45분 ice pack 교체 기록을 확인한다.
4. ECL A:B 혼합 시각과 첫 노출 시각 간격을 확인한다.

### 조치

- Transfer 불량이면 동일 lysate로 transfer부터 반복한다.
- Ponceau가 정상인데 ECL만 약하면 primary-secondary 조합과 ECL 상태를 확인한다.
- 항체 희석을 변경한 경우에는 새 조건을 run log에 별도로 남긴다.

## 2. Background가 높음

### 관찰

- 전체 membrane이 회색으로 보이거나 lane 사이 배경이 높다.
- 짧은 노출에서도 pERK band 주변이 번진다.

### 가능한 원인

1. 오래되었거나 침전이 생긴 BSA blocking solution
2. Secondary antibody 과농도
3. Wash 용량 부족 또는 용액 교환 누락
4. Membrane이 용기 벽에 붙어 wash가 균일하지 않음

### 확인 순서

- BSA 조제일과 보관 온도를 확인한다.
- Secondary lot과 실제 dilution 기록을 확인한다.
- 각 wash에서 새 TBST를 사용했는지 확인한다.
- Rocking platform이 70 rpm으로 작동했는지 확인한다.

### 조치

- 5% BSA in TBST를 새로 조제한다.
- Secondary 후 wash를 3 x 10 min으로 수행한다.
- 여전히 높으면 secondary 1:5000과 1:7500을 작은 membrane strip으로 비교한다.

## 3. 예상 위치 외 밴드

### 관찰

- pERK 예상 위치인 42/44 kDa 외에 55-70 kDa 영역에 강한 밴드가 보인다.

### 가능한 원인

- Primary antibody specificity
- Sample degradation 또는 불충분한 denaturation
- 과도한 단백질 loading

### 확인 순서 및 조치

1. 제조사 데이터시트의 예상 band pattern을 확인한다.
2. 95°C, 5 min denaturation 기록을 확인한다.
3. 20 μg/lane과 10 μg/lane을 비교한다.
4. Secondary-only control로 비특이적 secondary 결합을 확인한다.

## 4. 일부 lane만 약함

### 관찰

- Membrane 전체가 아니라 특정 lane 또는 원형 영역만 약하다.

### 판단

- 항체 농도보다 loading error, well 손상, transfer 기포 가능성이 높다.

### 조치

- Gel 이미지와 Ponceau S 이미지를 같은 lane 순서로 비교한다.
- 원형 공백은 cassette 기포 흔적으로 기록한다.
- 분석 ROI에 포함되면 해당 lane을 정량에서 제외하고 반복한다.

## 5. 신호 포화

### 관찰

- Band 중심이 흰색으로 뜨거나 lane 간 차이가 사라진다.

### 조치

- 10 sec부터 촬영하고 30 sec, 60 sec 순서로 늘린다.
- 정량에는 포화되지 않은 가장 긴 노출을 사용한다.
- 동일 비교군에는 같은 노출과 contrast 범위를 적용한다.

## 결과 판정 제안

### 정상 완료

- Ponceau S에서 모든 lane의 연속적인 transfer 패턴이 확인됨
- 42/44 kDa pERK doublet가 비포화 노출에서 구분됨
- 동일 노출에서 Vehicle과 BDNF 처리군을 비교 가능

### 재실험 또는 추가 확인

- Ponceau에서 특정 lane의 기포 공백이 정량 ROI와 겹침
- 모든 노출이 포화됨
- Primary 또는 secondary lot 기록이 누락됨

### 사용 중단

- Membrane이 건조됨
- 전극 방향 오류로 단백질이 membrane 반대 방향으로 이동함
- 시료 순서 또는 lane map을 복원할 수 없음

