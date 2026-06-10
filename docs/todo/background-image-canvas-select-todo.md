# TODO — 캔버스 클릭으로 배경 이미지 선택

캔버스에서 **배경 이미지를 클릭하면 선택(편집 모드 진입)** 되게 하는 기능. 한 번 구현했다가 UX 판단을 위해 제거했고, 필요 시 쉽게 되살릴 수 있도록 설계를 여기에 남겨 둔다.

> 관련 코드: `src/canvas/EditorStage.tsx`(`handleClick`, `bgEditMode`), `src/canvas/imageTransform.ts`(`BgRect`), `src/store/editorStore.ts`(`setBackgroundSelected`, `backgroundSelected`, `backgroundVisible`)
> 남아 있는 인접 기능: 패널 체크박스 + **파일명 클릭** 선택(`feat(panel): select background image by clicking its file name`)

## 현재 상태 (이 기능 없이)

- 배경 이미지는 평상시 **최하단 + `listening={false}`** 로 렌더된다(클릭 비수신). 그래서 캔버스 클릭으로는 선택되지 않는다.
- 선택 경로는 **컨트롤 패널의 체크박스 / 파일명 클릭** 뿐이다. 선택되면 `bgEditMode`가 켜져 이미지가 최상단으로 올라오고 Transformer가 붙는다.
- `handleClick`의 select 툴 분기에서 "빈 곳 클릭"은 항상 `clearSelection()` 한다.

## 핵심 아이디어 (왜 이렇게 했나)

> "그리드를 지워도 클릭 선택이 안 된다"의 원인은 **그리드가 아니다.** 막는 것은 이미지의 의도적 `listening={false}`. 이미지를 listening으로 바꾸면 이미지가 캔버스 대부분을 덮을 때 **마퀴 선택·점/선 드로잉 클릭을 가로채는** 부작용이 생긴다.

따라서 이미지는 **비수신 그대로 두고**, `handleClick`에서 클릭 좌표가 이미지 바운드 안인지 **수동 히트테스트**만 한다. 이러면 마퀴/드로잉은 그대로고, 그리드 표시 여부와 무관하게 동작한다.

## 구현 설계 (되살릴 때)

### 1) 바운드 판정 헬퍼 — `src/canvas/imageTransform.ts`

`BgRect`(이미 존재)를 받아 월드 점이 이미지 사각형 안인지 검사. `BackgroundImage`는 `BgRect`의 구조적 상위 타입이라 `background`를 그대로 넘길 수 있다.

```ts
/** True when world point (x, z) lies within the background image's bounds. */
export function pointInBgBounds(rect: BgRect, x: number, z: number): boolean {
  const right = rect.x + rect.naturalWidth * rect.scale
  const bottom = rect.z - rect.naturalHeight * rect.scale // z grows upward; image extends down
  return x >= rect.x && x <= right && z >= bottom && z <= rect.z
}
```

### 2) `handleClick` 분기 교체 — `src/canvas/EditorStage.tsx`

- `setBackgroundSelected` 구독 추가: `const setBackgroundSelected = useEditorStore((s) => s.setBackgroundSelected)`
- `import { ..., pointInBgBounds } from './imageTransform'`
- select 툴의 `else if (!additive)`(현재 `clearSelection()`)를 교체:

```ts
} else if (!additive) {
  // No geometry under the cursor: select the background image if the click
  // landed on it (it is otherwise non-listening), else clear the selection.
  const w = screenToWorld(vp, p.x, p.y)
  if (background && backgroundVisible && pointInBgBounds(background, w.x, w.z)) {
    setBackgroundSelected(true)
  } else {
    clearSelection()
  }
}
```

`setBackgroundSelected(true)`는 이미 (a) geometry selection 해제(상호 배타), (b) `tool='select'` 전환을 수행하므로 → `bgEditMode` 켜짐 → 이미지가 최상단으로 올라오고 Transformer가 붙는다. 즉 **클릭 한 번에 선택 + 편집 모드 진입**.

### 3) 테스트 — `src/canvas/imageTransform.test.ts`

`pointInBgBounds` describe 블록 추가(경계 포함 내부 true / 바깥 false). 예: TL(10,0), scale 2, 100×50 → x∈[10,210], z∈[-100,0].

## 보장되는 불변식 (왜 안전한가)

- **마퀴/드로잉 무영향**: 이미지는 계속 비수신. 드래그는 `finishMarquee` + `justMarqueed` 가드로 마퀴가 되고, **단일 클릭만** 선택으로 간다.
- **geometry 우선**: `kind === null`(커서 아래 점/선/면 없음)일 때만 바운드 판정. 이미지 위의 점을 클릭하면 점이 선택된다.
- **그리드 무관**: 그리드 레이어 가시성과 독립.

## 왜 제거했나 / 결정이 필요한 항목

- [ ] **큰 이미지에서의 "빈 곳 클릭"**: 이미지가 캔버스 대부분을 덮으면, 이미지 위 빈 공간을 클릭했을 때 선택 해제가 아니라 **배경이 선택**된다. 전체 해제는 이미지 바깥 클릭 / `Esc` / 패널 토글로 해야 함 → 다소 의외일 수 있어 제거함.
- [ ] **대안 경로로 충분한가**: 패널 체크박스 + 파일명 클릭으로 이미 선택 가능. 캔버스 클릭이 정말 필요한지 사용 패턴으로 판단.
- [ ] (선택) 절충안: "현재 아무 선택도 없을 때만" 캔버스 클릭으로 배경 선택 → 빈 곳 클릭의 해제 의미를 덜 해침.

## 트리거 (언제 다시 꺼낼까)

- 패널만으로 선택이 번거롭다는 피드백이 쌓일 때.
- 또는 위 "빈 곳 클릭" 의외성을 받아들이거나 절충안(아무 선택 없을 때만)으로 진행하기로 정할 때.

## 재구현 비용

작음(~15줄 + 헬퍼 1개 + 테스트 1블록). 헬퍼와 `handleClick` 한 분기가 전부이며, 다른 코드는 손대지 않는다.
