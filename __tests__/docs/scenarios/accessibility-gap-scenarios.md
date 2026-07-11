# Accessibility Gap Scenarios — api-key 0.12.0

사용자 지시로 10개 도메인 전수 평가에 포함 — 평가 결과:

## Gap: 검증 표면 없음 (신규 TC 0)

api-key 모듈 개편 범위는 core 서비스·에러 타입·next 핸들러 팩토리로, **렌더링되는 UI 요소가 전혀 없다**.
WCAG 2.1 AA 검증 대상(DOM, 색 대비, 포커스, ARIA)이 존재하지 않으므로 의미 있는 TC를 만들 수 없다
(placeholder 테스트는 Meaningful Test Rules 위반).

React UI 티어는 0.8에서 `@withwiz/ui`로 분리 — 접근성 검증은 해당 패키지 소유.
이 패키지에 남은 유일한 React 표면(`next/error/ErrorBoundary`)은 이번 변경 범위 밖.
