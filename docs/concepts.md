# 개념: Point · Line · Face · Type

poly-forge는 DynEarthSol3D(DES3D)용 2D `.poly`(PSLG) 메시 입력 파일을 만드는 에디터입니다.
사용자에게 노출되는 도메인 개념은 **Point / Line / Face** 세 가지이며, 각 Face는 선택적으로
**Type**(mattype + size)을 가질 수 있습니다.

> 좌표계: `x`는 수평, `z`는 깊이입니다(`z ≤ 0`, 아래로 내려갈수록 작아짐). 단위는 meter.

---

## 한눈에 보기

| 항목 | 차원 | 정체 | `.poly`에 저장? |
|---|---|---|---|
| **Point** | 0D | 좌표 `(x, z)` | ✅ node 섹션 |
| **Line** | 1D | 두 점을 잇는 선분 | ✅ segment 섹션 |
| **Face** | 2D | 닫힌 영역(앱이 계산) + 선택적 Type(mattype, size) | 면당 region 1개 자동 생성 |

핵심: **Line은 그린 선, Face는 그 선들이 만든 빈 칸(앱이 계산), Type은 Face에 부여한 재료·요소크기.**
파일의 region 섹션은 export 시 각 Face로부터 자동 산출됩니다.

---

## Point

- 꼭짓점입니다. `.poly`의 node 섹션에 `i x z`로 저장됩니다(id는 0부터 연속).
- 그리드 클릭, 또는 컨트롤 패널의 *Points* 섹션에서 추가합니다. 같은 좌표는 중복 생성되지 않고
  기존 점을 재사용합니다.

## Line

- 두 점을 잇는 **선**입니다. `.poly`의 segment 섹션에 `j p0 p1 bdry_flag`로 저장됩니다.
- `bdry_flag`(경계 플래그, BF)는 **단일 비트만** 허용됩니다:
  - `0` = 내부(점선으로 표시)
  - `1` = 좌(X0), `2` = 우(X1), `16` = 하(Z0), `32` = 상(Z1) — 각각 다른 색으로 표시
- 외곽 경계선은 도메인 가장자리에 놓이며, Lines 헤더의 `…` 메뉴에서 *Auto-assign boundary flags* 로
  자동 부여할 수 있습니다.

## Face

- Line들이 닫힌 고리를 이루면 그 **안쪽 빈 공간**을 앱이 자동으로 인식해 Face로 표시합니다
  (내부적으로 `@turf/polygonize` 사용).
- 각 Face는 **결정적인 id**(`face:${sorted-pointIds}`)를 가집니다. 같은 점 집합으로 다시 형성되면
  같은 id가 되며, 따라서 동일 Face의 Type은 자연스럽게 보존됩니다.

### Type (mattype + size)

- Face에 부여하는 메시 속성입니다. 내부 저장은 **면-키 맵** `faceTypes[faceId] = { mattype, size }`.
- Faces 섹션의 Type 셀로 mattype을 인라인 편집합니다. `size`는 SelectionBar의 *Set type…* 모달
  또는 Settings에서 일괄 편집합니다.
- Type이 미지정인 Face는 캔버스에 **회색**으로 표시되고, mattype별 색은 Settings → Materials에서
  지정합니다.

### 면 분할과 noding (T-junction)

면을 둘로 나누려면 그 면의 경계 위 두 점을 잇는 선을 그립니다. 새 점이 기존 변의 **중간**에
놓이면, polygonize가 인식할 수 있도록 그 변을 새 점에서 자동으로 쪼갭니다(noding). 점 도구는
커서가 변 근처에 있으면 **변 위로 스냅**되어, 비스듬한 경계에도 정확히 점을 올려놓고 면을 나눌 수
있습니다.

- 점 배치 스냅 우선순위: **기존 꼭짓점 → 변 위 투영점 → 그리드 교차점**.

> Face가 사라지면(예: 경계 line 삭제) 해당 Type은 stale 상태로 `faceTypes` 맵에 보관됩니다.
> 동일 Face가 다시 형성되면(예: Undo로 line을 복구) Type이 **자동 복구**됩니다.

### 면 분할 시 Type 동작

면 분할 시 자식 Face들의 점 집합은 부모와 다르므로 새로운 faceId를 얻고, **양쪽 자식 모두 Type
미지정** 상태가 됩니다. 부모의 Type은 stale로 보관되며, 분할 전 모양으로 Undo하면 복구됩니다.

---

## `.poly` 파일과의 매핑

```
#### node coordinates ####     <- Points
# npoints ndims 0 0
13 2 0 0
0 0 0
...
#### segments ####             <- Lines
# nsegments has_bdryflag
16 1
0 0 1 1                        # j p0 p1 bdry_flag
...
#### holes ####                <- 항상 0 (DES3D는 hole 미지원)
0
#### regions ####              <- 각 Face마다 자동 1행 생성 (export 시 산출)
3
0 250000 -20000 0 2e7          # k xk zk mattype size
...
```

`region` 섹션의 각 행은 Face별로 자동 생성됩니다(`xk·zk = interiorPoint(face)`,
`mattype = faceTypes[face.id]?.mattype ?? 0`, `size = faceTypes[face.id]?.size ?? -1`).
즉 `nregions == nFaces`이며 사용자가 region을 따로 편집할 일은 없습니다.

---

## 예시: rifting-2d 샘플 (13 / 16 / 4)

- **13 Points**: 단면의 꼭짓점들
- **16 Lines**: 바깥 테두리(좌=파랑, 우=빨강, 상=초록, 하=주황) + 지층을 나누는 내부 선(점선)
- **4 Faces**: 그 선들이 만든 4칸의 닫힌 영역. 상부 1칸은 Type `mattype=0`(파랑),
  하부 3칸은 Type `mattype=1`(빨강).

이 Face들 중 하나를 선으로 다시 나누면 Faces가 5로 늘어나고, 새로 생긴 두 Face는 Type을 잃어
회색으로 표시됩니다 — Faces 섹션의 Type 셀에 mattype을 입력하면 다시 색이 채워집니다.
