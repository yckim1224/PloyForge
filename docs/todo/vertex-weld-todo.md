# TODO — 좌표 중복점 자동 병합 (vertex weld)

이동(드래그/넛지)으로 점이 다른 점과 같은 좌표에 겹쳤을 때 **자동으로 하나의 노드로 병합**하는 기능. 현재는 미구현이며, 데이터 손상만 **검증 단계에서 차단**하는 안전망까지만 들어가 있다.

> 관련 커밋: `e90807e feat(io): flag coincident points as a validation error`
> 관련 코드: `src/poly/validate.ts`(중복점 검출), `src/store/editorStore.ts`(이동 경로)

## 현재 상태 (이미 구현된 안전망)

- `validateDocument`가 점을 `coordKey`(1mm 셀)로 묶어 한 셀에 2개 이상이면 **error**를 발생시킨다. `error`이므로 `onExport`(`src/panels/AppActions.tsx`)가 익스포트를 차단한다.
- 즉 **손상된 `.poly` 익스포트는 막히지만**, 겹친 점을 실제로 합쳐 주지는 않는다. 사용자가 직접 undo / 벌려놓기 / 삭제로 해소해야 한다.

## 왜 미뤘나 (핵심 난점)

- 점 생성(`addPoint`)은 `coordKey`로 디둡하지만 **이동 경로(`movePoint`/`nudgeSelection`/`translateSelectionBy`)는 디둡하지 않음** → 겹침 발생.
- `renode`는 "점이 **선 위**"인 경우만 처리(T-junction 분할). "점이 **다른 점 위**(꼭짓점 대 꼭짓점)"는 합치지 않음.
- 진짜 병합(weld)의 비용은 **`faceTypes`/`faceId` 재매핑**에 쏠려 있음: `faceId = sorted pointIds`(`src/types.ts`)라 병합으로 점 id 집합이 바뀌면 면의 `faceId`가 달라져 **재질(mattype/size)이 유실**된다. 이를 보존하려면 "기하학적으로 같은 면 → 새 faceId" 마이그레이션이 필요.

## 구현 설계 (weld 동작)

이동 커밋 직후 같은 `coordKey`의 점들을 하나로 합치는 연산. 한 곳(`weldCoincidentPoints()`)에 구현해 `translateSelectionBy`/`nudgeSelection`/`movePoint`에서 공유하는 것이 깔끔(altitude: 경로별 특수 처리 금지).

병합이 처리할 일(난이도 순):
1. **생존자 선택**: 같은 셀에서 어느 id를 남길지 규칙(예: 이동점을 정지점에 흡수 = 타깃 생존, 또는 더 작은 display index).
2. **선 참조 재작성**: 사라지는 점을 참조하는 모든 `line.p0/p1`을 생존자 id로 치환.
3. **자기루프 제거**: 치환 결과 `p0 === p1`이 된 선 삭제.
4. **중복 선 제거**: 같은 두 점을 잇는 선이 둘 이상이면 하나만 유지(`renode` Phase B의 dedupe 패턴 재사용).
5. **선택(selection) 갱신**: 사라진 점/선 id를 생존자/유효 id로 교체하거나 제거.
6. **faceTypes 재매핑(가장 까다로움)**: 병합으로 바뀐 면의 `faceId`를 추적해 `faceTypes` 항목을 옮김.

부가 고려:
- **언두**: `translateSelectionBy`와 같은 동기 버스트 안에서 호출하면 기존 `handleSet` 배칭 덕에 **드래그 1회 = 언두 1스텝** 유지.
- **허용 오차**: 병합 판정은 `addPoint`와 동일하게 `coordKey`(1mm).
- **자유 이동(Alt)**: 스냅을 꺼도 1mm 안에 들어오면 병합할지 결정 필요(보통 병합).

## 권장 단계

1. **(완료) 검증 안전망** — error로 익스포트 차단. ✅
2. **핵심 weld** — `weldCoincidentPoints()` + 이동 경로 3곳 호출. faceTypes 재매핑 포함.
3. **(선택) 드래그 스냅 UX** — 드래그 중 기존 점 근처에서 스냅+병합 미리보기(점 배치 시의 vertex 스냅과 동일 컨벤션).

## 결정이 필요한 항목

- [ ] **자동 병합 vs 검증 경고만**: 현재는 경고(error)만. 자동 병합은 편하지만 "두 점을 의도적으로 겹쳐 두는" 워크플로를 막음(현재 그런 워크플로 없음).
- [ ] **생존자 규칙**: 이동점→정지점 흡수 권장.
- [ ] **nudge에도 동일 적용**(일관성 위해 권장).

## 트리거 (언제 다시 꺼낼까)

- 사용자가 "꼭짓점 합치기(vertex-join)"를 **의도적으로** 원하는 워크플로가 실제로 요구될 때.
- 또는 검증 error로 막히는 사례가 잦아 수동 해소가 번거롭다는 피드백이 쌓일 때.
