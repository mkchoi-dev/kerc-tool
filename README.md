# 배출예약시스템 배차 Tool

배출예약시스템 지도 화면에서 핀 선택과 배차 작업을 보조하는 Tampermonkey userscript입니다.

## 설치

1. Chrome 또는 Edge에 Tampermonkey를 설치합니다.
2. 아래 링크를 엽니다.
3. Tampermonkey 설치 화면에서 `설치`를 누릅니다.

[배출예약시스템 배차 Tool 설치](https://cdn.jsdelivr.net/gh/mkchoi-dev/kerc-tool@main/kerc-helper.user.js)

## 링크를 눌렀는데 JS 파일만 다운로드될 때

브라우저가 `.user.js` 파일을 Tampermonkey로 넘기지 못한 상태입니다.

아래 방법으로 설치합니다.

1. Tampermonkey가 설치되어 있고 활성화되어 있는지 확인합니다.
2. 브라우저 오른쪽 위 Tampermonkey 아이콘을 누릅니다.
3. `대시보드`를 엽니다.
4. `유틸리티` 탭을 엽니다.
5. `URL에서 가져오기` 또는 `Import from URL` 입력칸에 아래 주소를 붙여넣습니다.
6. 설치 화면이 뜨면 `설치`를 누릅니다.

```text
https://cdn.jsdelivr.net/gh/mkchoi-dev/kerc-tool@main/kerc-helper.user.js
```

Tampermonkey가 설치되어 있지 않은 PC에서는 Chrome/Edge가 직접 사용자 스크립트를 설치하려고 하면서 `이 웹사이트에서 앱, 확장 또는 사용자 스크립트를 추가할 수 없습니다` 같은 메시지가 표시될 수 있습니다.

설치 후 자동 업데이트는 스크립트 내부의 `@updateURL` 설정에 따라 GitHub 원본 파일을 기준으로 확인합니다.

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
