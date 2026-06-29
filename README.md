# 배출예약시스템 배차 Tool 배포 방법

## 1. GitHub 저장소 만들기

GitHub에서 새 저장소를 만듭니다.

- 저장소명 예시: `dispatch-tool-userscript`
- 공개 범위: 링크를 받은 사람이 설치해야 하면 `Public` 권장
- 파일명은 반드시 `kerc-helper.user.js` 유지 권장

## 2. 자동 업데이트 URL 넣기

`kerc-helper.user.js` 상단 metadata 영역에 아래 두 줄을 추가합니다.

```js
// @downloadURL  https://raw.githubusercontent.com/GITHUB_ID/REPO_NAME/main/kerc-helper.user.js
// @updateURL    https://raw.githubusercontent.com/GITHUB_ID/REPO_NAME/main/kerc-helper.user.js
```

예시:

```js
// @downloadURL  https://raw.githubusercontent.com/my-id/dispatch-tool-userscript/main/kerc-helper.user.js
// @updateURL    https://raw.githubusercontent.com/my-id/dispatch-tool-userscript/main/kerc-helper.user.js
```

## 3. 사용자 설치 링크

사용자에게 아래 raw 링크를 전달합니다.

```text
https://raw.githubusercontent.com/GITHUB_ID/REPO_NAME/main/kerc-helper.user.js
```

사용자는 Tampermonkey가 설치된 브라우저에서 이 링크를 열고 설치하면 됩니다.

## 4. 업데이트 배포 방법

코드를 수정할 때마다 `@version`을 올립니다.

```js
// @version      1.0.1
```

그 다음 같은 GitHub 파일에 덮어 올리면 Tampermonkey가 주기적으로 새 버전을 확인해 자동 업데이트합니다.

## 5. 수동 업데이트 확인

사용자가 즉시 업데이트하고 싶을 때:

Tampermonkey 대시보드 -> 유틸리티 -> 사용자 스크립트 업데이트 확인

