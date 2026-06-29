# 배출예약시스템 배차 Tool

배출예약시스템 지도 화면에서 핀 선택과 배차 작업을 보조하는 Tampermonkey userscript입니다.

## 설치

1. Chrome 또는 Edge에 Tampermonkey를 설치합니다.
2. 아래 링크를 엽니다.
3. Tampermonkey 설치 화면에서 `설치`를 누릅니다.

[배출예약시스템 배차 Tool 설치](https://raw.githubusercontent.com/mkchoi-dev/kerc-tool/main/kerc-helper.user.js)

## 자동 업데이트

이 스크립트는 Tampermonkey 자동 업데이트를 지원합니다.

```js
// @downloadURL  https://raw.githubusercontent.com/mkchoi-dev/kerc-tool/main/kerc-helper.user.js
// @updateURL    https://raw.githubusercontent.com/mkchoi-dev/kerc-tool/main/kerc-helper.user.js
```

코드를 수정해 배포할 때는 `kerc-helper.user.js` 상단의 `@version` 값을 올린 뒤 GitHub에 업로드합니다.

예:

```js
// @version      1.0.1
```

## 수동 업데이트 확인

Tampermonkey 대시보드에서 `유틸리티` -> `사용자 스크립트 업데이트 확인`을 누르면 즉시 업데이트를 확인할 수 있습니다.

