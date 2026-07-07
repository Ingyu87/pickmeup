# CLAUDE.md

이 저장소는 아직 코드가 없는 **설계 단계**입니다. 이 문서는 `PRD.md`(기능 요구사항) / `design.md`(비주얼·UX 가이드)를 읽고 실제 구현에 들어갈 에이전트(Claude Code, Codex, Cursor 등)가 참고할 **단일 진실 공급원(source of truth)** 겸 실행 규칙입니다. 두 문서와 이 문서가 어긋나면 이 문서를 우선한다.

---

## 0. 제품 한 줄 정의

**픽미업! (Pick Me Up!)** — 초등 교실 전자칠판용 통합 추첨 포털. 반 명단을 한 번 입력하면 제비뽑기·돌림판·사다리타기·레이스·캡슐 뽑기 5개 게임을 골라 실행하고, 흰색 3D 클레이 **AI 로봇 마스코트**가 안내/진행/축하를 맡는다. 결과 화면에서 조/자리 배치까지 처리한다. **서버 없음, DB 없음** — 모든 상태는 브라우저 `localStorage`.

> `PRD.md` v0.3 / `design.md`(2번째 버전) 기준으로 제품명·storage key(`pickmeup:v1`) 정렬 완료. `design.md`는 더 이상 "신답룰렛" 카피가 아니라 로봇 마스코트 중심 오리지널 디자인 시스템으로 다시 작성됨 (design.md §15에서 "신답룰렛" 명칭 사용 자체를 금지 규칙으로 못 박음).

## 0.1. 이 제품이 신답룰렛과 실제로 다른 점 (구현 시 계속 지킬 것)

design.md 초안이 신답룰렛(네온 퍼플+픽셀 아케이드 레이스 앱) 무드보드에서 출발했기 때문에 "레퍼런스 냄새"가 남아있다는 지적이 있었다. 진짜 차별점은 **비주얼이 아니라 제품 구조**에 있으므로, 톤을 다듬는 것과 별개로 아래 5가지는 구현에서 절대 희석시키지 말 것.

1. **다중 게임 포털 vs 단일 레이스 앱** — 신답룰렛은 레이스 하나뿐. 픽미업!은 명단 1회 입력으로 5개 게임을 오가며 쓰고, 공통 결과 화면에서 조/자리 배치까지 이어진다 (PRD §1.2). Lobby의 "상황 필터"(1명/여러 명/순서/역할/재미)가 이 차별점을 체감시키는 핵심 화면이므로 후순위로 미루지 말 것.
2. **새로고침해도 안 죽는 앱** — F5, 탭 닫기, 오조작 후에도 명단·설정·결과가 그대로 복원됨 (PRD §5.5). 신답룰렛류 도구에는 없는, 화려하진 않지만 "매일 쓰는 도구"로서 가장 실질적인 차별점. Phase 1 P0로 취급.
3. **AI 로봇 마스코트 = 고정 진행자 캐릭터** — 신답룰렛엔 캐릭터 정체성이 없음. 픽미업!은 Hub 안내, Lobby 소개, 결과 축하까지 로봇이 감정 상태(웃음/놀람/축하/생각중)를 가지고 전 화면에 등장한다 (design.md §2). 게임별로 로봇 등장을 생략하지 말 것 — 이게 빠지면 "그냥 또 다른 레이스 앱"이 된다.
4. **공정성이 화면에 보인다** — 가중치("○○님은 N배 확률"), 제외/중복 허용 상태를 항상 노출 (PRD §7.1, design.md §4.3). 사다리타기 "조작 의심" 리스크(PRD §11)에 대한 실질적 해법이므로 생략 금지.
5. **서버/계정 없음 = 학생 개인정보가 기기 밖으로 안 나감** — 교육기관 특성상 이 자체가 신뢰 포인트. 마케팅 문구가 아니라 실제 아키텍처 제약(§7 비목표)으로 지킬 것.

톤 다듬기(네온 비중 축소, 화이트/파스텔 확대 등)는 아래 §6 토큰에 이미 반영되어 있음 — 이건 "화장"이고, 위 5개가 "본질"이라는 우선순위를 잊지 말 것.

---

## 1. 기술 스택 (PRD §8 확정)

- **Framework:** Vite + React + TypeScript
- **Routing:** React Router — `/`, `/lobby`, `/game/:id`, `/result`
- **State:** Zustand + `persist` middleware (debounce 300~500ms)
- **Styling:** Tailwind CSS (design.md §6 CSS 변수를 Tailwind theme으로 이식)
- **Animation:** `lottie-react` + Canvas (역할 분담은 §5 참고)
- **Storage:** `localStorage` key = `pickmeup:v1` (서버 전송 절대 금지)
- **Export:** `html2canvas` (결과 이미지 저장)
- **Deploy:** Vercel (정적 SPA)
- **Dev Skill:** `text-to-lottie` — 이미 `.agents/skills/text-to-lottie`에 설치됨 (`skills-lock.json` 확인됨)

### 디렉터리 구조 (목표, PRD §8.1)

```
public/lottie/<game>/<scene>/lottie.json
src/
  app/                    # routes: /, /lobby, /game/:id, /result
  components/
    portal/               # RosterForm, GameCard, ResultPanel
    robot/                # 로봇 마스코트 컴포넌트 (Lottie 기반, 감정 상태별)
    lottie/               # LottiePlayer, LazyLottie
  games/
    wheel/  lot/  ladder/  race/  slot/
  lib/
    draw.ts               # pool 생성, Fisher-Yates shuffle, 가중치
    parseRoster.ts        # "이름*3" 파서
    storage.ts            # localStorage read/write, quota, migrate — 단일 진입점
  stores/
    session.ts            # Zustand + persist (debounced)
```

새 파일을 만들 때 이 구조를 벗어나지 말 것. 특히 `storage.ts`는 **localStorage 접근의 유일한 진입점**이어야 함 — 다른 곳에서 직접 `localStorage.setItem` 호출 금지.

---

## 2. 데이터 모델 (PRD §7, 변경 없이 그대로 구현)

```typescript
interface Participant {
  name: string;
  weight: number;      // default 1, "이름*3" 파싱 결과
  excluded: boolean;   // 이번 회차만 제외
}

interface ClassProfile {
  id: string;
  className: string;
  participants: Participant[];
  updatedAt: number;
}

interface DrawResult {
  gameId: 'wheel' | 'lot' | 'ladder' | 'race' | 'slot';
  winners: string[];
  rankings?: { name: string; rank: number }[];
  assignments?: { name: string; label: string }[];  // ladder
  drawnAt: number;
}

interface GameSettings {
  wheel: { winnerCount: number; sequential: boolean };
  lot: { count: number; allowDuplicate: boolean; revealMode: 'sequential' | 'batch'; theme: string };
  ladder: { labels: string[]; revealMode: 'one' | 'all' };
  race: { winMode: 'first' | 'last'; winnerCount: number; mapId: string; speed: 'normal' | 'fast' };
  slot: { mode: 'slot' | 'gacha'; theme: string };
}
```

> **네이밍 주의:** 내부 `gameId`/타입은 계속 `slot`을 쓰지만, 사용자 노출 문구는 design.md §5.3 가이드에 따라 항상 **"캡슐 뽑기"** 로 표기한다 (도박 연상 회피). 코드 식별자와 UI 라벨을 분리할 것.

**추첨 알고리즘:** `excluded` 제외 → `weight`만큼 이름 duplicate → Fisher-Yates shuffle. 재추첨 시 `winners`를 `excluded`에 merge 후 pool 재생성. 가중치 사용 시 설정 화면에 "○○님은 N배 확률" 고지 필수 (공정성 UI, §0.1-4).

---

## 3. 로컬 저장 — 가장 많이 틀리기 쉬운 부분 (PRD §5.5)

이 앱은 **DB/API가 없다**는 게 핵심 차별점(§0.1-2)이므로 아래를 정확히 지킬 것.

```typescript
/** localStorage key: `pickmeup:v1` */
interface PersistedAppState {
  version: 1;
  savedAt: number;
  session: { className: string; rosterText: string; participants: Participant[]; excludedIds: string[] };
  navigation: { path: string };
  preferences: { soundEnabled: boolean; bgmEnabled: boolean };
  gameSettings: GameSettings;
  lastResult: DrawResult | null;
}
```

- **저장 대상 O:** 반 이름/명단/제외체크, 마지막 route, 게임별 설정, 소리 설정, 마지막 `DrawResult`
- **저장 대상 X:** Lottie 재생 프레임, Canvas 레이스 좌표 (매번 새로 시작)
- 상태 변경 → **debounce 300~500ms** 후 write (P-01)
- 앱 로드 시 hydrate 끝난 뒤 렌더 (Hub 빈 화면 보여주지 말 것, P-02)
- 게임 **진행 중** 새로고침 → MVP는 게임 설정 화면으로 fallback (mid-game resume은 Phase 2 이후)
- 스키마에 `version` 필드 필수, 이후 마이그레이션 함수 자리 미리 만들어둘 것 (v1→v2 대비)
- 「저장된 데이터 전부 지우기」는 반드시 확인 다이얼로그 통과 후 실행 (일반 입력과 실수로 섞이면 안 됨)
- quota 초과·localStorage 미지원(시크릿 모드) 시 **조용히 실패시키지 말고** 에러 토스트 + JSON export 안내 — 문구는 design.md §9.7 상태표 그대로 사용 ("자동 저장됨", "저장할 수 없어요", "이 브라우저에서는 자동 저장이 제한돼요")

---

## 4. 게임별 구현 매트릭스

design.md §5의 최신 우선순위(구현 난도·실용성 기준)와 PRD §5.4 요구사항을 합친 기준. **design.md의 Phase 순서를 실제 착수 순서로 따른다** (PRD의 Phase 2 뭉치보다 더 세분화됨).

| 게임 | Phase | P0 핵심 | 비고 |
|---|---|---|---|
| 제비뽑기 (Lot) | 1 | 1/N/전원, 중복 여부, 순차·일괄 공개 | 가장 실용적 — 발표자 뽑기 커버. Lottie: 손 넣기→꺼내기→쪽지 펼침 |
| 돌림판 (Wheel) | 1 | 칸 자동구성, 감속 스핀, 1명/N명/순차 | 전자칠판 대표 화면. Lottie: 당첨 순간 confetti |
| 사다리타기 (Ladder) | 1.5 | 자동 생성, 구슬 낙하 연출 | 역할·모둠 배정에 유용하나 구현 난도 있음. 선생님 드래그 그리기는 P2(선택) |
| 레이스 (Race) | 2 | 1등/꼴찌, 프리셋 맵, Canvas 물리 | 몰입감 최고지만 물리/순위 구현 부담 큼. 맵 편집기는 스코프 아웃 |
| 캡슐 뽑기 (내부 `slot`) | 3 | 3릴/캡슐, 도박 연상 완화 카피 | UI 명칭은 항상 "캡슐 뽑기" (§2 참고) |

Phase 순서를 건너뛰지 말 것: **Phase 1(포털 + 제비뽑기 + 돌림판 + 로컬저장 P-01~P-05,P-10,P-12) 완료 없이 Phase 1.5/2 게임에 손대지 않는다.**

---

## 5. Lottie / 로봇 마스코트 통합 규칙

design.md §12.1 제작 우선순위 + `text-to-lottie` 스킬의 레시피 라우팅표(SKILL.md)를 대조해서, 각 에셋마다 **어떤 레시피/프리셋/타이밍을 쓸지 미리 확정**해둔다. 실제 제작 에이전트가 매번 레시피를 새로 고르지 않도록 하기 위함.

| 우선순위 | 에셋 | 용도 | 스킬 레시피 | 프리셋 | 프레임(60fps) |
|---|---|---|---|---|---|
| P0 | `robot/guide` | Hub 안내, loop | `recipe-loaders-icons` (empty-state 계열) + design-taste "Playful/character" 모드 | 로봇 고유 제스처 loop (표준 프리셋 없음, 아래 5.2 참고) | 60–120 (seamless loop) |
| P0 | `lot/reveal-paper` | 제비뽑기 결과, once | `recipe-ui-microinteractions` + motion-taste "Reveal Grammar" | `notification-pop`에서 파생 (build→settle→hold) | 45–90 |
| P0 | `wheel/win-burst` | 돌림판 당첨, once | `recipe-visual-effects` | `bubble-burst` / `spark-accent` | 20–45 (burst) |
| P1 | `robot/celebrate` | 결과 화면 축하, once | `recipe-loaders-icons` (state-feedback) + design-taste "Playful/character" | `check-complete` 변형 (체크 대신 로봇 포즈) | 30–75 |
| P1 | `ladder/path-highlight` | 사다리 경로 강조, once | `recipe-diagram-technical` | `scan-highlight` (경로를 따라 하이라이트 이동) | 60–90 (단순 1경로라 하한 쪽) |
| P2 | `robot/empty-state` | 빈 상태 안내, loop | `recipe-loaders-icons` ("empty state" 별칭 정확히 일치) | 없음 — 감정 신호 1개만(윙크/둘러봄) | 60–120 (seamless loop) |

- 역할 분담: intro/outro·confetti·로봇 감정표현 = Lottie / 버튼 hover·레이아웃·레이스 실시간 물리 = Canvas·CSS
- 공통 `LottiePlayer` 컴포넌트: play / pause / goToAndStop / destroy 지원
- `prefers-reduced-motion` 시 Lottie 스킵, 정적 결과만 표시 (reduced-motion 상태에서는 지연 없이 즉시 정적 결과, design.md §11.3)
- 소리 off ≠ Lottie 정지 (Lottie는 계속 재생, SFX만 mute)
- JSON은 게임 진입 시 lazy load, **런타임(우리 앱) 에셋 경로는** `public/lottie/<game>/<scene>/lottie.json`
- 로봇 얼굴은 항상 **눈 2개 + 미소 1개** 수준으로 단순하게 (design.md §2.4), 무섭거나 SF스러운 표현 금지, 로봇이 교사용 입력 UI를 가리지 않게 배치
- 신규 에셋 필요 시 이미 설치된 `text-to-lottie` skill 사용 (`.agents/skills/text-to-lottie`), 텍스트는 이미지에 넣지 말고 placeholder 레이어로 요청 → 런타임에 실제 이름 주입

### 5.1 ⚠️ 스킬 작업 경로 vs 앱 런타임 경로 (혼동 주의)

`text-to-lottie` 스킬은 **우리 앱 폴더 안에서 직접 작업하지 않는다.** 스킬의 `player-contract.md`에 따르면:

- 씬 제작·미리보기·검증은 `npx degit diffusionstudio/lottie my-animation` 으로 만든 **별도의 Skia Skottie 플레이어 프로젝트**(자체 Vite dev server, 기본 포트 3030)에서 이뤄진다.
- 그 프로젝트 안에서 씬 파일 경로는 `public/lottie/<game>/<scene>/lottie.json`이 **아니라** `public/projects/<project-slug>/<scene-N>/lottie.json` 이며, `controls.json`으로 슬롯을 노출하고 `?frame=N`으로 프레임을 찍어 검증한다.
- 따라서 실제 워크플로는 **2단계**다: ① 플레이어 프로젝트에서 씬을 만들고 `/__context`, 프레임 검증까지 마친다 → ② 완성된 `lottie.json`(및 폰트/이미지 에셋)만 우리 앱의 `public/lottie/<game>/<scene>/lottie.json`으로 **복사**해 온다.
- 스킬이 우리 앱 저장소에 파일을 자동으로 떨어뜨려 준다고 가정하지 말 것 — Lottie 에셋 작업을 맡길 때는 "어느 프로젝트/씬에서 작업했는지"와 "우리 앱 경로로 복사 완료했는지"를 항상 확인한다.

### 5.2 프로젝트 하우스 모션 스타일 (스킬의 design-taste.md / motion-taste.md에서 확정)

design.md §4.1("교사는 빠르게, 학생은 즐겁게")을 스킬의 **Style Presets**(motion-taste.md)로 구체화하면:

| 화면 성격 | 하우스 스타일 프리셋 | 근거 |
|---|---|---|
| Hub / Lobby / 설정 카드 | `soft-interface` (작은 이동거리, 낮은 오버슛, 짧은 지속시간) | 명확성 우선 — 교사가 수업 중 빠르게 조작해야 함 |
| 게임 실행 · 당첨 순간 · 결과 축하 | `playful-pop` (큰 스케일 대비, 친근한 오버슛, 빠른 회복) | 몰입감 우선 — 학생이 보는 화면 |

공통 규칙 (design-taste.md / motion-taste.md에서 발췌, 반드시 지킬 것):

- **크롬 예산 0**: 로봇/카드/버튼 주변에 의미 없는 프레이밍 카드·보더·디바이더를 추가하지 않는다. 여백과 정렬로 위계를 만들 것 (design-taste "Chrome/container budget is 0").
- **로봇 = "Playful/character" 모드**: 한 씬에 감정 신호(윙크/끄덕임/바운스) **하나만** 확실히 준다. 여러 개를 겹치면 캐릭터가 산만해진다.
- **이징 앵커 매핑**: 카드/패널 등장 = `entrance-sharp`→`settle-soft` / 당첨·버스트 순간 = `expressive-pop`(오버슛 허용) / 로봇 loop 제스처 = `travel-balanced` / 사다리 하이라이트 이동 = 선형(트림 패스 기본) + 노드 도착만 `settle-soft`.
- **linear easing은 회전·스캔·진행바에만** 사용하고 나머지는 절대 균일한 ease 하나로 퉁치지 않는다 (motion-taste "Avoid linear interpolation unless mechanical motion is the intent").
- **루프 이음새**: `robot/guide`, `robot/empty-state`는 첫/끝 프레임의 위치·투명도·체감 속도를 일치시켜 이음새가 안 보이게 만든다.
- **효과는 항상 역할이 있어야 함**: `wheel/win-burst`의 confetti/burst는 당첨 확정 프레임에만 붙고, 그 프레임을 빼도 "누가 당첨됐는지"는 로봇+이름 카드만으로 읽혀야 한다 (visual-effects "Keep the base composition readable without the effect").
- **reduced-motion 시 전부 스킵**: 위 스타일은 전부 `prefers-reduced-motion` 미해당 사용자 기준. reduced-motion에서는 즉시 정적 결과로 대체 (기존 §5 규칙 유지).

---

## 6. 디자인 토큰 (design.md §6, 최신 버전 — 이전 신답룰렛풍 네온 팔레트는 폐기됨)

```css
:root {
  /* Brand */
  --pick-purple-950: #22005C;
  --pick-purple-800: #4B16B8;
  --pick-purple-600: #7551F2;
  --pick-lime-400: #BFFF22;
  --pick-lime-300: #DFFF64;
  --pick-pink-400: #FF6FCF;
  --pick-yellow-400: #FFD84A;
  --pick-mint-400: #73F7C5;

  /* Surface */
  --paper: #FFFDF8;
  --surface: #FFFFFF;
  --surface-lavender: #F3EDFF;
  --surface-pink: #FFF0F8;
  --surface-lime: #F4FFD0;

  /* Text */
  --ink: #171320;
  --ink-purple: #32126A;
  --muted: #6F6484;

  /* Feedback */
  --success: #3CD278;
  --warning: #FFB02E;
  --danger: #FF5C7A;
}
```

- 사용 비율: 배경/넓은 면(화이트·연보라·딥퍼플) 55% / 카드·입력 25% / 주요 CTA(라임) 8% / 보조 강조(핑크·노랑·민트) 8% / 텍스트·라인 4%
- 화면별 배경 원칙(design.md §6.2): Hub = 밝은 연보라+흰 카드 / Lobby = 보라 계열+게임 카드 / Game = 게임별 배경 / Result = 밝은 축하 배경 / Fullscreen = 딥퍼플 또는 게임별 몰입 배경
- 본문 폰트: `Pretendard/SUIT/Noto Sans KR`, 포인트(타이틀·당첨문구·큰 숫자)만 선택적으로 픽셀 폰트(`Galmuri11` 등)
- 크기 기준: 대형 당첨자 이름 56px+ / 화면 제목 36px+ / 카드 제목 24px+ / 본문 18px+ / 버튼 20px+
- **원칙: 교사용 설정 화면 = 명확성·밝음 우선, 게임 화면만 조금 더 화려하게** — 설정 화면을 게임 화면처럼 산만하게 만들지 않는다 (design.md §15)
- 버튼 색상은 3종으로 제한: 주 버튼(라임 `.btn-primary`) / 보조(화이트 `.btn-secondary`) / 위험(핑크 `.btn-danger`) — 버튼마다 색을 다르게 쓰지 않는다
- 접근성: `prefers-reduced-motion` 필수 지원, 색상만으로 정보 전달 금지(아이콘+텍스트 병행)
- 한글 텍스트는 절대 이미지 안에 넣지 않음 — 항상 실제 DOM 텍스트 레이어

### UX 문구 (design.md §14, 그대로 사용)

시작=`시작하기` · 뽑기 실행=`뽑기!` · 돌림판=`돌리기!` · 결과=`당첨!` · 재추첨=`당첨자 빼고 다시` · 다른 게임=`다른 게임` · 처음=`처음으로` · 복사=`결과 복사` · 저장=`이미지 저장`

문구 원칙: 짧게, 초등학생도 이해할 표현, 교사용 설정은 명확하게 / 학생용 결과는 즐겁게.

---

## 7. 비목표 (Out of Scope — MVP, 절대 만들지 말 것)

- 회원가입, 클라우드 동기화, 서버 API, DB
- 학생/학부모용 별도 앱
- 실시간 멀티 디바이스 연동
- 레이스 맵 편집기 (Phase 3 이후 재검토)
- 여러 선생님 간 데이터 공유 (JSON export/import로 대체, 자동 동기화 아님)
- 카드 안에 카드를 중첩하는 레이아웃, 화면마다 다른 버튼 색 체계 (design.md §15 금지 규칙)

---

## 8. 최종 확정 사항 (구현 착수 전 결정 완료, 2026-07-07)

착수 전 검토에서 나온 항목들을 아래처럼 확정한다. **이후 이 CLAUDE.md가 다시 갱신되지 않는 한 이 결정을 기본값으로 따른다.**

| # | 항목 | 결정 |
|---|---|---|
| 1 | 서비스 범위 | **학교(교실) 용도로 확정.** 캠프 선발처럼 교실 밖에서 "N명 뽑기"로 재사용되는 케이스는 환영하되, Hub 카피·페르소나·기능 우선순위는 계속 초등 담임 선생님(PRD §3.1) 기준으로 설계한다. 별도 "모집/선발" 페르소나나 전용 UI는 만들지 않는다. |
| 2 | Q2: `lottie-react` vs `lottie-web` | **`lottie-react` 채택.** 우리는 Lottie 내장 텍스트 슬롯을 쓰지 않고 이름은 항상 DOM 오버레이로 얹는 방식(§0.1 참고)이라, `lottie-web`을 직접 래핑해서 얻는 이점(슬롯 API 직접 제어)이 필요 없다. `lottie-react`의 `useLottie`/ref로 play/pause/goToAndStop/destroy를 그대로 구현할 수 있어 DX가 더 낫다. Q2는 종료. |
| 3 | Lottie 제작 워크플로 실행 주체 | **구현 에이전트(Claude)가 처리.** Phase 1에서 `robot/guide` 등 P0 에셋이 필요한 시점에 `npx degit diffusionstudio/lottie my-animation` 플레이어 프로젝트를 직접 스캐폴딩하고, §5.1의 2단계 워크플로(플레이어에서 제작·검증 → 앱 경로로 복사)를 수행한다. 사용자가 별도로 신경 쓸 필요 없음. |
| 4 | Git 원격 저장소 | `https://github.com/Ingyu87/pickmeup.git` 에 이 시점 문서 상태를 초기 커밋으로 push (아래 §8.1 기록). |
| 5 | 로봇 마스코트 이미지 | `ChatGPT Image ...png` 2장은 **무드보드가 아니라 최종 확정 캐릭터 원본**이다 (ChatGPT 이미지 생성 결과물). design.md §2의 캐릭터 정체성·색상·표정 규칙은 이 두 이미지를 기준으로 그대로 따르고, 별도로 다시 그리지 않는다. Lottie화(벡터/애니메이션 변환) 작업 시 이 두 이미지를 그라운드 레퍼런스로 사용한다. |
| 6 | 착수 시점 | 지금은 **문서 최종 정리 단계**이며, 실제 Vite 프로젝트 스캐폴딩 등 구현은 사용자가 별도로 "구현해줘"라고 명시적으로 요청할 때 시작한다. |

PRD §12의 나머지 오픈 퀘스천 중 급하지 않은 것: **Q3**(레이스 물리 수준)은 레이스가 Phase 2로 밀렸으므로 Phase 2 착수 직전에 결정.

### 8.1 저장소 정보

- Remote: `https://github.com/Ingyu87/pickmeup.git`
- 이 시점 커밋에는 `PRD.md`, `design.md`, `CLAUDE.md`, 로봇 마스코트 레퍼런스 이미지 2장, `.agents/`(text-to-lottie skill), `skills-lock.json`이 포함된다. 아직 앱 코드는 없다 (§8 항목 6).

---

## 9. 진행 체크리스트 (Phase 1)

- [ ] Vite/React 프로젝트 스캐폴딩 + 라우팅 4개 경로
- [ ] `stores/session.ts` (Zustand + persist, debounce) + `lib/storage.ts`
- [ ] Hub 화면 (로봇 안내 영역 + 반이름/명단/가중치/제외 카드, 자동저장 상태 표시)
- [ ] Lobby 화면 (상황 필터 + 게임 카드 갤러리, 제비뽑기·돌림판 우선 노출)
- [ ] 제비뽑기 + 돌림판 게임 구현
- [ ] 공통 결과 화면 (당첨 하이라이트 + 로봇 축하, 재추첨, 다른 게임)
- [ ] Lottie: `robot/guide`, `lot/reveal-paper`, `wheel/win-burst`
- [ ] JSON export/import, 「저장된 데이터 지우기」 확인 다이얼로그
- [ ] Vercel 배포
