// ==UserScript==
// @name         배출예약시스템 배차 Tool
// @namespace    kerc-helper
// @version      1.0.3
// @author       myungkwon Choi
// @description  지도 핀 드래그/올가미/우클릭 선택으로 배출예약 배차 작업을 보조합니다.
// @match        https://adm.15990903.or.kr/admin/collect/selectPageListCollectMgt.do*
// @include      https://adm.15990903.or.kr/admin/collect/selectPageListCollectMgt.do*
// @downloadURL  https://raw.githubusercontent.com/mkchoi-dev/kerc-tool/main/kerc-helper.user.js
// @updateURL    https://raw.githubusercontent.com/mkchoi-dev/kerc-tool/main/kerc-helper.user.js
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const LOG_PREFIX = '[KERC Helper]';
  const COORD_PRECISION = 7;
  const SHORTCUT_STORAGE_KEY = 'kercHelper.batchDispatchShortcut';
  const TONG_DISPATCH_SHORTCUT_STORAGE_KEY = 'kercHelper.tongDispatchShortcut';
  const CLEAR_SHORTCUT_STORAGE_KEY = 'kercHelper.clearShortcut';
  const SELECTED_COLOR_STORAGE_KEY = 'kercHelper.selectedColor';
  // 회사 CI 이미지를 표시하려면 여기에 이미지 URL을 넣으세요.
  const CI_IMAGE_URL = 'https://i.postimg.cc/vTXMBjMF/02-gug-yeongmun-jwauhyeong.png';
  const RIGHT_CLICK_POINT_THRESHOLD = 5;
  const DEFAULT_SELECTED_COLOR = '#ff0000';

  const coordVisitMap = new Map();
  const coordCustomMap = new Map();
  const customDetailMap = new Map();

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  function getBatchDispatchShortcut() {
    return localStorage.getItem(SHORTCUT_STORAGE_KEY) || 'F2';
  }

  function getTongDispatchShortcut() {
    return localStorage.getItem(TONG_DISPATCH_SHORTCUT_STORAGE_KEY) || 'F8';
  }

  function getClearShortcut() {
    return localStorage.getItem(CLEAR_SHORTCUT_STORAGE_KEY) || 'QSE';
  }

  function getSelectedColor() {
    const color = localStorage.getItem(SELECTED_COLOR_STORAGE_KEY) || DEFAULT_SELECTED_COLOR;
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_SELECTED_COLOR;
  }

  function setBatchDispatchShortcut(value) {
    localStorage.setItem(SHORTCUT_STORAGE_KEY, value);
  }

  function setTongDispatchShortcut(value) {
    localStorage.setItem(TONG_DISPATCH_SHORTCUT_STORAGE_KEY, value);
  }

  function setClearShortcut(value) {
    localStorage.setItem(CLEAR_SHORTCUT_STORAGE_KEY, value);
  }

  function setSelectedColor(value) {
    const color = String(value || '').trim();
    localStorage.setItem(
      SELECTED_COLOR_STORAGE_KEY,
      /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_SELECTED_COLOR
    );
  }

  function getShortcutLabel(value) {
    if (!value) return '설정 안 됨';
    if (value === 'CtrlEnter') return 'Ctrl+Enter';

    const labels = {
      F2: 'F2',
      F4: 'F4',
      F8: 'F8',
      F9: 'F9',
      F6: 'F6',
      F7: 'F7',
      QSE: 'QSE',
      CtrlEnter: 'Ctrl+Enter'
    };

    return labels[value] || String(value);
  }

  function normalizeShortcutValue(value) {
    if (value === 'CtrlEnter') return 'Ctrl+Enter';
    return String(value || '').trim();
  }

  function getShortcutFromEvent(event) {
    const key = String(event.key || '');
    const code = String(event.code || '');

    if (
      key === 'Control' ||
      key === 'Shift' ||
      key === 'Alt' ||
      key === 'Meta' ||
      code === 'ControlLeft' ||
      code === 'ControlRight' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'AltLeft' ||
      code === 'AltRight' ||
      code === 'MetaLeft' ||
      code === 'MetaRight'
    ) {
      return null;
    }

    let mainKey = '';

    if (/^F([1-9]|1[0-2])$/.test(key)) {
      mainKey = key;
    } else if (/^Key[A-Z]$/.test(code)) {
      mainKey = code.replace('Key', '');
    } else if (/^Digit[0-9]$/.test(code)) {
      mainKey = code.replace('Digit', '');
    } else if (key === ' ') {
      mainKey = 'Space';
    } else if (key.length === 1) {
      mainKey = key.toUpperCase();
    } else {
      mainKey = key;
    }

    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    parts.push(mainKey);

    return parts.join('+');
  }

  function isShortcutEvent(event, shortcut) {
    return getShortcutFromEvent(event) === normalizeShortcutValue(shortcut);
  }

  function isConfiguredBatchShortcut(event) {
    return isShortcutEvent(event, getBatchDispatchShortcut());
  }

  function isConfiguredTongShortcut(event) {
    return isShortcutEvent(event, getTongDispatchShortcut());
  }

  function normalizeCoord(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(COORD_PRECISION);
  }

  function coordKey(lat, lng) {
    const normalizedLat = normalizeCoord(lat);
    const normalizedLng = normalizeCoord(lng);
    if (!normalizedLat || !normalizedLng) return null;
    return `${normalizedLat},${normalizedLng}`;
  }

  function isLat(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 33 && n <= 39;
  }

  function isLng(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 124 && n <= 132;
  }

  function isVisitId(value) {
    return /^\d{8}$/.test(String(value || ''));
  }

  function normalizeCustomId(value) {
    if (value == null) return null;

    const s = String(value)
      .replace(/^custom/i, '')
      .trim();

    return /^\d+$/.test(s) ? s : null;
  }

  function addToSetMap(map, key, id) {
    if (!key || !id) return;

    if (!map.has(key)) {
      map.set(key, new Set());
    }

    map.get(key).add(String(id));
  }

  function addVisitCoord(lat, lng, id) {
    const key = coordKey(lat, lng);
    if (!key || !isVisitId(id)) return;
    addToSetMap(coordVisitMap, key, String(id));
  }

  function addCustomCoord(lat, lng, id, detailCnt) {
    const customId = normalizeCustomId(id);
    const key = coordKey(lat, lng);

    if (!key || !customId) return;

    addToSetMap(coordCustomMap, key, customId);

    const detail = Number(detailCnt);
    if (Number.isFinite(detail) && detail > 0) {
      customDetailMap.set(customId, detail);
    } else if (!customDetailMap.has(customId)) {
      customDetailMap.set(customId, 1);
    }
  }

  function keyMatches(key, patterns) {
    const normalized = String(key || '')
      .replace(/[_\-\s]/g, '')
      .toLowerCase();

    return patterns.some(pattern => pattern.test(normalized));
  }

  function findValueByKey(obj, patterns) {
    if (!obj || typeof obj !== 'object') return null;

    for (const [key, value] of Object.entries(obj)) {
      if (keyMatches(key, patterns)) {
        return value;
      }
    }

    return null;
  }

  function findAllValuesByKey(obj, patterns) {
    if (!obj || typeof obj !== 'object') return [];

    return Object.entries(obj)
      .filter(([key]) => keyMatches(key, patterns))
      .map(([, value]) => value);
  }

  function getLatLngPairs(obj) {
    if (!obj || typeof obj !== 'object') return [];

    const explicitLatValues = findAllValuesByKey(obj, [
      /^lat$/,
      /^latitude$/,
      /^y$/,
      /lat/
    ]).filter(isLat);

    const explicitLngValues = findAllValuesByKey(obj, [
      /^lng$/,
      /^lon$/,
      /^long$/,
      /^longitude$/,
      /^x$/,
      /lng/,
      /lon/
    ]).filter(isLng);

    if (explicitLatValues.length && explicitLngValues.length) {
      return explicitLatValues.flatMap(lat =>
        explicitLngValues.map(lng => ({ lat, lng }))
      );
    }

    const values = Object.values(obj)
      .map(value => Number(value))
      .filter(Number.isFinite);

    const latCandidates = values.filter(isLat);
    const lngCandidates = values.filter(isLng);

    return latCandidates.flatMap(lat =>
      lngCandidates.map(lng => ({ lat, lng }))
    );
  }

  function scanAjaxObject(obj, depth = 0, seen = new WeakSet()) {
    if (!obj || depth > 7) return;
    if (typeof obj !== 'object') return;
    if (seen.has(obj)) return;
    seen.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach(value => scanAjaxObject(value, depth + 1, seen));
      return;
    }

    const pairs = getLatLngPairs(obj);

    const reserveSn = findValueByKey(obj, [
      /^reservesn$/,
      /reservesn/,
      /resvesn/
    ]);

    const customReserveSn = findValueByKey(obj, [
      /^customreservesn$/,
      /customreservesn/,
      /customresvesn/
    ]);

    const detailCnt = findValueByKey(obj, [
      /^detailcnt$/,
      /detailcnt/,
      /pointcnt/,
      /customcnt/
    ]);

    if (pairs.length) {
      if (isVisitId(reserveSn)) {
        pairs.forEach(({ lat, lng }) => addVisitCoord(lat, lng, reserveSn));
      }

      if (customReserveSn != null) {
        pairs.forEach(({ lat, lng }) => {
          addCustomCoord(lat, lng, customReserveSn, detailCnt);
        });
      }
    }

    Object.values(obj).forEach(value => scanAjaxObject(value, depth + 1, seen));
  }

  function scanKnownGlobalArrays() {
    try {
      [
        W.allDriverReserveList,
        W.customAllDriveReserveList,
        W.markerList,
        W.customMarkerList
      ].forEach(list => {
        if (Array.isArray(list)) {
          list.forEach(row => scanAjaxObject(row));
        }
      });
    } catch (error) {
      warn('전역 배열 스캔 실패:', error);
    }
  }

  function getAjaxOptions(args) {
    if (!args.length) return null;
    if (args[0] && typeof args[0] === 'object') return args[0];
    if (typeof args[0] === 'string' && args[1] && typeof args[1] === 'object') {
      return args[1];
    }
    return null;
  }

  function installAjaxCapture() {
    const timer = setInterval(() => {
      if (!W.$ || !W.$.ajax || W.$.ajax.__kercWrapped) return;

      const originalAjax = W.$.ajax;

      W.$.ajax = function (...args) {
        const options = getAjaxOptions(args);

        if (options) {
          const originalSuccess = options.success;

          options.success = function (response, textStatus, jqXHR) {
            try {
              scanAjaxObject(response);
              scanKnownGlobalArrays();

              log('AJAX 인덱스 갱신:', {
                visitCoordCount: coordVisitMap.size,
                customCoordCount: coordCustomMap.size,
                customDetailCount: customDetailMap.size
              });
            } catch (error) {
              warn('AJAX 인덱스 실패:', error);
            }

            if (typeof originalSuccess === 'function') {
              return originalSuccess.apply(this, arguments);
            }

            return undefined;
          };
        }

        return originalAjax.apply(this, args);
      };

      W.$.ajax.__kercWrapped = true;
      log('AJAX 캡처 설치 완료');
      clearInterval(timer);
    }, 50);
  }

  function startWhenReady() {
    const timer = setInterval(() => {
      if (!document.body) return;

      const isTargetPage =
        location.href.includes('/admin/collect/selectPageListCollectMgt.do');

      if (!isTargetPage) return;

      clearInterval(timer);
      initUi();
    }, 300);
  }

  function normalizeRect(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      right: Math.max(x1, x2),
      bottom: Math.max(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

    function isIntersect(a, b) {
      return !(
        b.left > a.right ||
        b.right < a.left ||
        b.top > a.bottom ||
        b.bottom < a.top
      );
    }

    function pointInRect(point, rect) {
      return (
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      );
    }

    function pointInPolygon(point, polygon) {
      if (!polygon || polygon.length < 3) return false;

      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        const intersects =
          ((yi > point.y) !== (yj > point.y)) &&
          point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

        if (intersects) inside = !inside;
      }

      return inside;
    }

    function getRectCenter(rect) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }

    function normalizeSelectionShape(shape) {
      if (shape && shape.type) return shape;
      return {
        type: 'rect',
        rect: shape
      };
    }

    function isRectInSelectionShape(rect, shape) {
      const normalizedShape = normalizeSelectionShape(shape);
      if (normalizedShape.type === 'polygon') {
        return pointInPolygon(getRectCenter(rect), normalizedShape.points);
      }

      return isIntersect(normalizedShape.rect, rect);
    }

  function getDragMode(event) {
    if (event.altKey) return 'subtract';
    if (event.ctrlKey) return 'add';
    return 'replace';
  }

  function getDragModeLabel(mode) {
      if (mode === 'add') return '추가';
      if (mode === 'subtract') return '빼기';
      return '새 선택';
  }

  function getMapArea() {
    return document.querySelector('#map');
  }

  function getOverlapCount(overlapEl) {
    const n = parseInt((overlapEl.textContent || '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getOverlapPins() {
    return [...document.querySelectorAll('div[id^="overlapCoord"]')]
      .filter(el => getOverlapCount(el) > 0);
  }

  function getOverlapArgs(overlapEl) {
    const onclick = overlapEl.getAttribute('onclick') || '';
    const match = onclick.match(
      /showOverlapOverlay\s*\(\s*(\d+)\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/
    );

    if (!match) return null;

    return {
      index: Number(match[1]),
      lat: match[2],
      lng: match[3]
    };
  }

  function isMarkerVisible(img) {
    const rect = img.getBoundingClientRect();
    const style = getComputedStyle(img);
    const holder = img.parentElement;
    const holderStyle = holder ? getComputedStyle(holder) : null;

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      (!holderStyle || holderStyle.display !== 'none')
    );
  }

  function getVisibleMarkers() {
    return [...document.querySelectorAll('img.markerImgGroup')]
      .filter(isMarkerVisible);
  }

  function getCustomDetailFromDom(customId) {
    const id = normalizeCustomId(customId);
    if (!id) return 1;

    const selectors = [
      `.customDivide[data-id="custom${id}"]`,
      `.customDivide[data-id="${id}"]`,
      `[data-id="custom${id}"].customDivide`,
      `[data-id="${id}"].customDivide`
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const n = Number((el.textContent || '').replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }

    return customDetailMap.get(id) || 1;
  }

  function addCustomItem(customMap, customId, detailCnt) {
    const id = normalizeCustomId(customId);
    if (!id) return;

    const detail = Number(detailCnt);
    const finalDetail = Number.isFinite(detail) && detail > 0
      ? detail
      : getCustomDetailFromDom(id);

    customMap.set(id, finalDetail || 1);
  }

  function markerTypeFromImg(img) {
    const title = img.getAttribute('title') || '';
    const src = img.getAttribute('src') || '';
    const dataId = img.getAttribute('data-id') || '';

    if (/^custom\d+$/i.test(title)) {
      return {
        type: 'custom',
        id: normalizeCustomId(title)
      };
    }

    if (/custom/i.test(src) && /^\d+$/.test(title)) {
      return {
        type: 'custom',
        id: normalizeCustomId(title)
      };
    }

    if (/^custom\d+$/i.test(dataId)) {
      return {
        type: 'custom',
        id: normalizeCustomId(dataId)
      };
    }

    if (isVisitId(title)) {
      return {
        type: 'visit',
        id: title
      };
    }

    return {
      type: 'unknown',
      id: null
    };
  }

  function initUi() {
    if (document.querySelector('#kerc-helper-panel')) return;

    log('?ㅽ뻾:', location.href);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let selectedVisitIds = [];
    let selectedCustomItems = new Map();
    let selectedOverlapCount = 0;
    let unresolvedOverlapCount = 0;
    let currentDragMode = 'replace';
    let selectionMode = 'rect';
    let lassoPoints = [];
    let lastVisualRefreshAt = 0;
    let lastDragPreviewAt = 0;
    let previewTargetX = 0;
    let previewTargetY = 0;
    let previewCurrentX = 0;
    let previewCurrentY = 0;
    let previewHasPosition = false;
    let previewAnimationFrame = null;
    let lastMouseX = null;
    let lastMouseY = null;
    let qseBuffer = '';
    let lastQseKeyAt = 0;

    const selectBox = document.createElement('div');
    selectBox.style.cssText = [
      'position: fixed',
      'display: none',
      'z-index: 9999998',
      'border: 2px dashed #0080c8',
      'background: rgba(0, 128, 200, 0.15)',
      'pointer-events: none'
    ].join(';');
    document.body.appendChild(selectBox);

    const lassoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lassoSvg.setAttribute('width', '100%');
    lassoSvg.setAttribute('height', '100%');
    lassoSvg.style.cssText = [
      'position: fixed',
      'display: none',
      'left: 0',
      'top: 0',
      'width: 100vw',
      'height: 100vh',
      'z-index: 9999998',
      'pointer-events: none',
      'overflow: visible'
    ].join(';');

    const lassoPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lassoPath.setAttribute('fill', 'rgba(37, 99, 235, 0.12)');
    lassoPath.setAttribute('stroke', '#2563eb');
    lassoPath.setAttribute('stroke-width', '2');
    lassoPath.setAttribute('stroke-dasharray', '6 4');
    lassoPath.setAttribute('stroke-linejoin', 'round');
    lassoSvg.appendChild(lassoPath);
    document.body.appendChild(lassoSvg);

    const dragPreview = document.createElement('div');
    dragPreview.style.cssText = [
      'position: fixed',
      'display: none',
      'z-index: 9999999',
      'pointer-events: none',
      'background: rgba(20,20,20,0.82)',
      'color: #fff',
      'border-radius: 4px',
      'padding: 4px 6px',
      'font-size: 12px',
      'font-weight: 700',
      'line-height: 1.25',
      'white-space: pre-line',
      'box-shadow: 0 2px 7px rgba(0,0,0,0.25)'
    ].join(';');
    document.body.appendChild(dragPreview);

    const panel = document.createElement('div');
    panel.id = 'kerc-helper-panel';
    panel.style.cssText = [
      'position: fixed',
      'right: 20px',
      'bottom: 20px',
      'z-index: 9999999',
      'background: #ffffff',
      'border: 1px solid #d7dde5',
      'border-radius: 8px',
      'padding: 12px',
      'font-size: 13px',
      'color: #111',
      'box-shadow: 0 8px 24px rgba(15,23,42,.18)',
      'min-width: 260px',
      'line-height: 1.35',
      'font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ].join(';');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0;">
          <img id="kerc-helper-ci" alt="CI" style="display:none;width:auto;height:34px;max-width:96px;object-fit:contain;box-sizing:border-box;padding:4px 5px;background:#fff;flex:0 0 auto;">
          <div style="font-weight:800;font-size:13px;color:#0f172a;line-height:1.25;">배출예약시스템 배차 Tool</div>
        </div>
        <button id="kerc-helper-collapse" class="kerc-collapse-button" type="button" title="접기" aria-label="접기" aria-expanded="true">
          <span class="kerc-chevron" aria-hidden="true"></span>
        </button>
      </div>
      <div id="kerc-helper-body">
        <div id="kerc-helper-count" style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-weight:800;color:#0f172a;">
          <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">방 0</span>
          <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">맞 0</span>
          <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;">P 0</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button id="kerc-helper-open" type="button" style="border:0;background:#2563eb;color:#fff;border-radius:6px;padding:6px 8px;font-weight:700;font-size:12px;cursor:pointer;">일괄배차(${getShortcutLabel(getBatchDispatchShortcut())})</button>
          <button id="kerc-helper-tong" type="button" style="border:0;background:#dc2626;color:#fff;border-radius:6px;padding:6px 8px;font-weight:700;font-size:12px;cursor:pointer;">통배차(${getShortcutLabel(getTongDispatchShortcut())})</button>
          <button id="kerc-helper-clear" type="button" style="border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:6px;padding:6px 8px;font-weight:700;font-size:12px;cursor:pointer;">초기화</button>
        </div>
        <div id="kerc-helper-settings-box" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;">
          <label for="kerc-helper-selection-mode" style="display:block;margin-bottom:4px;color:#475569;font-size:12px;font-weight:700;">선택 방식</label>
          <select id="kerc-helper-selection-mode" style="width:100%;height:30px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;margin-bottom:8px;">
            <option value="rect">블록 드래그</option>
            <option value="lasso">올가미</option>
          </select>
          <label for="kerc-helper-selected-color" style="display:block;margin-bottom:4px;color:#475569;font-size:12px;font-weight:700;">선택 핀 강조 색상</label>
          <input id="kerc-helper-selected-color" type="color" value="${getSelectedColor()}" style="width:100%;height:30px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;margin-bottom:8px;padding:2px 4px;">
          <label for="kerc-helper-shortcut" style="display:block;margin-bottom:4px;color:#475569;font-size:12px;font-weight:700;">일괄배차 단축키</label>
          <input id="kerc-helper-shortcut" type="text" readonly value="${getShortcutLabel(getBatchDispatchShortcut())}" placeholder="클릭 후 단축키 입력" style="width:100%;height:30px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;margin-bottom:8px;padding:0 7px;cursor:pointer;">
          <label for="kerc-helper-tong-shortcut" style="display:block;margin:8px 0 4px;color:#475569;font-size:12px;font-weight:700;">통배차 단축키</label>
          <input id="kerc-helper-tong-shortcut" type="text" readonly value="${getShortcutLabel(getTongDispatchShortcut())}" placeholder="클릭 후 단축키 입력" style="width:100%;height:30px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;margin-bottom:8px;padding:0 7px;cursor:pointer;">
          <label for="kerc-helper-clear-shortcut" style="display:block;margin:8px 0 4px;color:#475569;font-size:12px;font-weight:700;">초기화 단축키</label>
          <input id="kerc-helper-clear-shortcut" type="text" readonly value="${getShortcutLabel(getClearShortcut())}" placeholder="클릭 후 단축키 입력" style="width:100%;height:30px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;padding:0 7px;cursor:pointer;">
          <div style="margin-top:6px;color:#94a3b8;font-size:11px;line-height:1.35;">입력칸을 클릭한 뒤 원하는 키 조합을 누르세요. 초기화는 QSE도 사용할 수 있습니다.</div>
        </div>
        <span id="kerc-helper-shortcut-label" style="display:none;">${getShortcutLabel(getBatchDispatchShortcut())}</span>
        <span id="kerc-helper-tong-shortcut-label" style="display:none;">${getShortcutLabel(getTongDispatchShortcut())}</span>
        <div id="kerc-helper-index" style="margin-top:8px;color:#94a3b8;font-size:11px;">좌표 인덱스 확인 중</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding-top:6px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:10px;">
        <button id="kerc-helper-settings" type="button" style="border:0;background:transparent;color:#64748b;padding:0;font-size:10px;font-weight:700;cursor:pointer;">설정</button>
        <span>mg.choi@e-cycle.or.kr</span>
      </div>
    `;
    document.body.appendChild(panel);

    const helperStyle = document.createElement('style');
    helperStyle.textContent = `
      #kerc-helper-body {
        overflow: hidden;
        max-height: 520px;
        opacity: 1;
        transform: translateY(0);
        transition:
          max-height 220ms ease,
          opacity 170ms ease,
          transform 220ms ease;
      }

      #kerc-helper-panel.kerc-collapsed #kerc-helper-body {
        max-height: 0;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-4px);
      }

      .kerc-collapse-button {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #d8e0ea;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        color: #475569;
        border-radius: 7px;
        padding: 0;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15,23,42,0.08);
        transition:
          background 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }

      .kerc-collapse-button:hover {
        background: #f1f5f9;
        border-color: #c5d0dc;
        box-shadow: 0 2px 6px rgba(15,23,42,0.13);
      }

      .kerc-collapse-button:active {
        transform: translateY(1px);
        box-shadow: 0 1px 2px rgba(15,23,42,0.08);
      }

      .kerc-chevron {
        width: 8px;
        height: 8px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(45deg) translate(-1px, -1px);
        transition: transform 220ms ease;
      }

      #kerc-helper-panel.kerc-collapsed .kerc-chevron {
        transform: rotate(-135deg) translate(-1px, -1px);
      }

      @keyframes kercMarkerPulse {
        from {
          filter: drop-shadow(0 0 3px var(--kerc-selected-color, #ff0000));
          opacity: 0.9;
        }
        to {
          filter: drop-shadow(0 0 5px var(--kerc-selected-color, #ff0000));
          opacity: 1;
        }
      }

      img.kerc-selected-marker {
        outline: none !important;
        background: transparent !important;
        filter: none !important;
      }

      .kerc-selected-marker-tint {
        position: absolute !important;
        background: var(--kerc-selected-color, #ff0000) !important;
        pointer-events: none !important;
        z-index: 999998 !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center !important;
        mask-position: center !important;
        -webkit-mask-size: 100% 100% !important;
        mask-size: 100% 100% !important;
        animation: kercMarkerPulse 0.75s ease-in-out infinite alternate !important;
      }

      .kerc-selected-marker-holder {
        z-index: 999999 !important;
      }

      .kerc-selected-overlap {
        box-shadow:
          0 0 0 4px rgba(255,255,255,0.95),
          0 0 0 8px var(--kerc-selected-color, #ff0000),
          0 0 16px var(--kerc-selected-color, #ff0000) !important;
        outline: 3px solid var(--kerc-selected-color, #ff0000) !important;
        color: #ffffff !important;
        background: var(--kerc-selected-color, #ff0000) !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(helperStyle);

    const countEl = panel.querySelector('#kerc-helper-count');
    const indexEl = panel.querySelector('#kerc-helper-index');
    const collapseButton = panel.querySelector('#kerc-helper-collapse');
    const settingsButton = panel.querySelector('#kerc-helper-settings');
    const settingsBox = panel.querySelector('#kerc-helper-settings-box');
    const ciImg = panel.querySelector('#kerc-helper-ci');
    const selectionModeSelect = panel.querySelector('#kerc-helper-selection-mode');
    const selectedColorInput = panel.querySelector('#kerc-helper-selected-color');
    const shortcutSelect = panel.querySelector('#kerc-helper-shortcut');
    const tongShortcutSelect = panel.querySelector('#kerc-helper-tong-shortcut');
    const clearShortcutSelect = panel.querySelector('#kerc-helper-clear-shortcut');
    const shortcutLabelEl = panel.querySelector('#kerc-helper-shortcut-label');
    const tongShortcutLabelEl = panel.querySelector('#kerc-helper-tong-shortcut-label');
    const openButton = panel.querySelector('#kerc-helper-open');
    const tongButton = panel.querySelector('#kerc-helper-tong');
    const clearButton = panel.querySelector('#kerc-helper-clear');
    let isPanelCollapsed = false;

    function updateCiUi() {
      const url = String(CI_IMAGE_URL || '').trim();

      if (url) {
        ciImg.src = url;
        ciImg.style.display = 'block';
      } else {
        ciImg.removeAttribute('src');
        ciImg.style.display = 'none';
      }
    }

    function updateSelectedColorUi() {
      const color = getSelectedColor();
      panel.style.setProperty('--kerc-selected-color', color);
      document.documentElement.style.setProperty('--kerc-selected-color', color);
      selectedColorInput.value = color;
    }

    function updateShortcutUi() {
      const shortcut = getBatchDispatchShortcut();
      const label = getShortcutLabel(shortcut);

      shortcutSelect.value = shortcut;
      shortcutLabelEl.textContent = label;
      openButton.textContent = `일괄배차(${label})`;

      const tongShortcut = getTongDispatchShortcut();
      const tongLabel = getShortcutLabel(tongShortcut);
      tongShortcutSelect.value = tongShortcut;
      tongShortcutLabelEl.textContent = tongLabel;
      tongButton.textContent = `통배차(${tongLabel})`;

      const clearShortcut = getClearShortcut();
      const clearLabel = getShortcutLabel(clearShortcut);
      clearShortcutSelect.value = clearShortcut;
      clearButton.textContent = `초기화(${clearLabel})`;
    }

    function setPanelCollapsed(collapsed) {
      isPanelCollapsed = collapsed;
      panel.classList.toggle('kerc-collapsed', collapsed);
      collapseButton.title = collapsed ? '펼치기' : '접기';
      collapseButton.setAttribute('aria-label', collapsed ? '펼치기' : '접기');
      collapseButton.setAttribute('aria-expanded', String(!collapsed));

      if (collapsed) {
        settingsBox.style.display = 'none';
      }
    }

    updateCiUi();
    updateSelectedColorUi();
    updateShortcutUi();

    setInterval(() => {
      scanKnownGlobalArrays();
      indexEl.textContent =
        `좌표 인덱스: 방 ${coordVisitMap.size} / 맞 ${coordCustomMap.size}`;
    }, 1000);

    function styleSelectBoxByMode(mode) {
      if (mode === 'add') {
        selectBox.style.border = '3px dashed #00a85a';
        selectBox.style.background = 'rgba(0, 168, 90, 0.18)';
      } else if (mode === 'subtract') {
        selectBox.style.border = '3px dashed #ff2d55';
        selectBox.style.background = 'rgba(255, 45, 85, 0.16)';
      } else {
        selectBox.style.border = '2px dashed #0080c8';
        selectBox.style.background = 'rgba(0, 128, 200, 0.15)';
      }
    }

    function clearVisuals() {
      document.querySelectorAll('img.markerImgGroup').forEach(img => {
        img.classList.remove('kerc-selected-marker');
        img.style.filter = '';
        img.style.outline = '';

        if (img.parentElement) {
          img.parentElement.classList.remove('kerc-selected-marker-holder');
          img.parentElement.style.zIndex = '';
        }
      });

      document.querySelectorAll('.kerc-selected-marker-tint').forEach(tint => {
        tint.remove();
      });

      getOverlapPins().forEach(el => {
        el.classList.remove('kerc-selected-overlap');
        el.style.boxShadow = '';
        el.style.outline = '';
      });
    }

    function markSelectedImg(img) {
      img.classList.add('kerc-selected-marker');

      if (img.parentElement) {
        const holder = img.parentElement;

        holder.classList.add('kerc-selected-marker-holder');
        holder.style.zIndex = '999999';

        if (getComputedStyle(holder).position === 'static') {
          holder.style.position = 'relative';
        }

        const imgRect = img.getBoundingClientRect();
        const holderRect = holder.getBoundingClientRect();
        const src = img.currentSrc || img.src;
        let tint = [...holder.children]
          .find(child => child.classList.contains('kerc-selected-marker-tint'));

        if (!tint) {
          tint = document.createElement('div');
          tint.className = 'kerc-selected-marker-tint';
          holder.appendChild(tint);
        }

        tint.style.left = `${imgRect.left - holderRect.left}px`;
        tint.style.top = `${imgRect.top - holderRect.top}px`;
        tint.style.width = `${imgRect.width}px`;
        tint.style.height = `${imgRect.height}px`;
        tint.style.webkitMaskImage = `url("${src}")`;
        tint.style.maskImage = `url("${src}")`;
      }
    }

    function markFinalSelectionVisuals() {
      clearVisuals();

      const visitSet = new Set(selectedVisitIds.map(String));
      const customSet = new Set([...selectedCustomItems.keys()].map(String));

      getVisibleMarkers().forEach(img => {
        const marker = markerTypeFromImg(img);

        if (marker.type === 'visit' && visitSet.has(String(marker.id))) {
          markSelectedImg(img);
        }

        if (marker.type === 'custom' && customSet.has(String(marker.id))) {
          markSelectedImg(img);
        }
      });

      getOverlapPins().forEach(overlapEl => {
        const args = getOverlapArgs(overlapEl);
        const key = args ? coordKey(args.lat, args.lng) : null;
        if (!key) return;

        const visitIds = coordVisitMap.has(key)
          ? [...coordVisitMap.get(key)]
          : [];

        const customIds = coordCustomMap.has(key)
          ? [...coordCustomMap.get(key)]
          : [];

        const hasSelectedVisit = visitIds.some(id => visitSet.has(String(id)));
        const hasSelectedCustom = customIds.some(id => customSet.has(String(id)));

        if (hasSelectedVisit || hasSelectedCustom) {
          overlapEl.classList.add('kerc-selected-overlap');
        }
      });
    }

    function hasSelection() {
      return selectedVisitIds.length > 0 || selectedCustomItems.size > 0;
    }

    function refreshSelectionVisuals() {
      if (!hasSelection()) return;

      const now = Date.now();
      if (now - lastVisualRefreshAt < 150) return;
      lastVisualRefreshAt = now;

      markFinalSelectionVisuals();
    }

    function scheduleSelectionVisualRefresh(delay = 80) {
      window.setTimeout(refreshSelectionVisuals, delay);
    }

    function writeSelectionToPage() {
      W.selectMarkerList = selectedVisitIds.length
        ? `${selectedVisitIds.join(',')},`
        : '';

      W.selectCustomMarkerList = selectedCustomItems.size
        ? `${[...selectedCustomItems.entries()]
            .map(([id, detail]) => `${id}/${detail || 1}`)
            .join(',')},`
        : '';
    }

    function clearSelection() {
      selectedVisitIds = [];
      selectedCustomItems = new Map();
      selectedOverlapCount = 0;
      unresolvedOverlapCount = 0;

      W.selectMarkerList = '';
      W.selectCustomMarkerList = '';

      clearVisuals();
      hideDragPreview();

      renderCountBadges(0, 0, 0);
      log('선택 초기화');
    }

    function isMapDispatchModalVisible() {
      const modal = document.querySelector('#modal_caralc_change');
      if (!modal) return true;

      const style = getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function resetWhenMapModalClosed() {
      if (isMapDispatchModalVisible()) return;

      if (hasSelection() || dragPreview.style.display !== 'none') {
        clearSelection();
      }

      dragging = false;
      selectBox.style.display = 'none';
      resetLasso();
      hideDragPreview();

      if (W.map && typeof W.map.setDraggable === 'function') {
        W.map.setDraggable(true);
      }
    }

    function updatePanel() {
      const visitCnt = selectedVisitIds.length;
      const customCnt = selectedCustomItems.size;
      const customPointCnt = [...selectedCustomItems.values()]
        .reduce((sum, value) => sum + Number(value || 0), 0);

      renderCountBadges(visitCnt, customCnt, customPointCnt);
      updateSelectionSummaryPreview();
    }

    function renderCountBadges(visitCnt, customCnt, customPointCnt) {
      countEl.innerHTML = `
        <span style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;border-radius:6px;padding:5px 8px;">방 ${visitCnt}</span>
        <span style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:6px;padding:5px 8px;">맞 ${customCnt}</span>
        <span style="background:#f8fafc;border:1px solid #cbd5e1;color:#334155;border-radius:6px;padding:5px 8px;">P ${customPointCnt}</span>
      `;
    }
    function getCurrentSelectionCounts() {
      const customPointCnt = [...selectedCustomItems.values()]
        .reduce((sum, value) => sum + Number(value || 0), 0);

      return {
        visitCnt: selectedVisitIds.length,
        customCnt: selectedCustomItems.size,
        customPointCnt
      };
    }

    function formatShortCounts(counts) {
      return `방 ${counts.visitCnt} / 맞 ${counts.customCnt} / P ${counts.customPointCnt}`;
    }

    function collectNormalMarkersInRect(rect, visitSet, customMap) {
      getVisibleMarkers().forEach(img => {
        const markerRect = img.getBoundingClientRect();
        const marker = markerTypeFromImg(img);

        if (!marker.id || !isIntersect(rect, markerRect)) {
          return;
        }

        if (marker.type === 'visit') {
          visitSet.add(String(marker.id));
        } else if (marker.type === 'custom') {
          addCustomItem(customMap, marker.id, getCustomDetailFromDom(marker.id));
        }
      });
    }

    function collectNormalMarkersInShape(shape, visitSet, customMap) {
      const normalizedShape = normalizeSelectionShape(shape);

      if (normalizedShape.type === 'rect') {
        collectNormalMarkersInRect(normalizedShape.rect, visitSet, customMap);
        return;
      }

      getVisibleMarkers().forEach(img => {
        const markerRect = img.getBoundingClientRect();
        const marker = markerTypeFromImg(img);

        if (!marker.id || !isRectInSelectionShape(markerRect, normalizedShape)) {
          return;
        }

        if (marker.type === 'visit') {
          visitSet.add(String(marker.id));
        } else if (marker.type === 'custom') {
          addCustomItem(customMap, marker.id, getCustomDetailFromDom(marker.id));
        }
      });
    }

    function collectOverlapPinsInRect(rect, visitSet, customMap) {
      scanKnownGlobalArrays();

      const overlapPins = getOverlapPins()
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && isIntersect(rect, r);
        });

      overlapPins.forEach(overlapEl => {
        selectedOverlapCount += 1;

        const count = getOverlapCount(overlapEl);
        const args = getOverlapArgs(overlapEl);
        const key = args ? coordKey(args.lat, args.lng) : null;

        const visitIds = key && coordVisitMap.has(key)
          ? [...coordVisitMap.get(key)]
          : [];

        const customIds = key && coordCustomMap.has(key)
          ? [...coordCustomMap.get(key)]
          : [];

        visitIds.forEach(id => visitSet.add(String(id)));

        customIds.forEach(id => {
          addCustomItem(
            customMap,
            id,
            customDetailMap.get(String(id)) || getCustomDetailFromDom(id)
          );
        });

        const foundCnt = visitIds.length + customIds.length;

        log('겹침핀 처리:', {
          overlapId: overlapEl.id,
          displayedCount: count,
          visitIds,
          customIds,
          foundCount: foundCnt,
          onclick: overlapEl.getAttribute('onclick')
        });

        if (count > 0 && foundCnt < count) {
          unresolvedOverlapCount += 1;
          warn(
            `겹침핀 일부 확인 필요: ${overlapEl.id}, 표시=${count}, 확인=${foundCnt}`,
            overlapEl
          );
        }
      });
    }

    function collectOverlapPinsInShape(shape, visitSet, customMap, options = {}) {
      const normalizedShape = normalizeSelectionShape(shape);
      if (normalizedShape.type === 'rect' && !options.preview) {
        collectOverlapPinsInRect(normalizedShape.rect, visitSet, customMap);
        return;
      }

      scanKnownGlobalArrays();

      getOverlapPins()
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && isRectInSelectionShape(r, normalizedShape);
        })
        .forEach(overlapEl => {
          if (!options.preview) {
            selectedOverlapCount += 1;
          }

          const count = getOverlapCount(overlapEl);
          const args = getOverlapArgs(overlapEl);
          const key = args ? coordKey(args.lat, args.lng) : null;

          const visitIds = key && coordVisitMap.has(key)
            ? [...coordVisitMap.get(key)]
            : [];

          const customIds = key && coordCustomMap.has(key)
            ? [...coordCustomMap.get(key)]
            : [];

          visitIds.forEach(id => visitSet.add(String(id)));

          customIds.forEach(id => {
            addCustomItem(
              customMap,
              id,
              customDetailMap.get(String(id)) || getCustomDetailFromDom(id)
            );
          });

          if (!options.preview && count > 0 && visitIds.length + customIds.length < count) {
            unresolvedOverlapCount += 1;
          }
        });
    }

    function collectOverlapPinElement(overlapEl, visitSet, customMap, options = {}) {
      scanKnownGlobalArrays();

      if (!options.preview) {
        selectedOverlapCount += 1;
      }

      const count = getOverlapCount(overlapEl);
      const args = getOverlapArgs(overlapEl);
      const key = args ? coordKey(args.lat, args.lng) : null;

      const visitIds = key && coordVisitMap.has(key)
        ? [...coordVisitMap.get(key)]
        : [];

      const customIds = key && coordCustomMap.has(key)
        ? [...coordCustomMap.get(key)]
        : [];

      visitIds.forEach(id => visitSet.add(String(id)));

      customIds.forEach(id => {
        addCustomItem(
          customMap,
          id,
          customDetailMap.get(String(id)) || getCustomDetailFromDom(id)
        );
      });

      if (!options.preview && count > 0 && visitIds.length + customIds.length < count) {
        unresolvedOverlapCount += 1;
      }

      return visitIds.length + customIds.length;
    }

    function collectPointSelection(clientX, clientY, visitSet, customMap) {
      const elements = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(clientX, clientY)
        : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

      for (const el of elements) {
        const markerImg = el.closest && el.closest('img.markerImgGroup');
        if (markerImg && isMarkerVisible(markerImg)) {
          const marker = markerTypeFromImg(markerImg);

          if (marker.type === 'visit' && marker.id) {
            visitSet.add(String(marker.id));
            return true;
          }

          if (marker.type === 'custom' && marker.id) {
            addCustomItem(customMap, marker.id, getCustomDetailFromDom(marker.id));
            return true;
          }
        }

        const overlapEl = el.closest && el.closest('div[id^="overlapCoord"]');
        if (overlapEl && getOverlapCount(overlapEl) > 0) {
          collectOverlapPinElement(overlapEl, visitSet, customMap);
          return true;
        }
      }

      const markerAtPoint = getVisibleMarkers().find(img => {
        const r = img.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      });

      if (markerAtPoint) {
        const marker = markerTypeFromImg(markerAtPoint);

        if (marker.type === 'visit' && marker.id) {
          visitSet.add(String(marker.id));
          return true;
        }

        if (marker.type === 'custom' && marker.id) {
          addCustomItem(customMap, marker.id, getCustomDetailFromDom(marker.id));
          return true;
        }
      }

      const overlapAtPoint = getOverlapPins().find(overlapEl => {
        const r = overlapEl.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      });

      if (overlapAtPoint) {
        collectOverlapPinElement(overlapAtPoint, visitSet, customMap);
        return true;
      }

      return false;
    }

    function collectOverlapPinsInRectPreview(rect, visitSet, customMap) {
      scanKnownGlobalArrays();

      getOverlapPins()
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && isIntersect(rect, r);
        })
        .forEach(overlapEl => {
          const args = getOverlapArgs(overlapEl);
          const key = args ? coordKey(args.lat, args.lng) : null;

          const visitIds = key && coordVisitMap.has(key)
            ? [...coordVisitMap.get(key)]
            : [];

          const customIds = key && coordCustomMap.has(key)
            ? [...coordCustomMap.get(key)]
            : [];

          visitIds.forEach(id => visitSet.add(String(id)));

          customIds.forEach(id => {
            addCustomItem(
              customMap,
              id,
              customDetailMap.get(String(id)) || getCustomDetailFromDom(id)
            );
          });
        });
    }

    function getPreviewSelectionCounts(shape, mode) {
      const dragVisitSet = new Set();
      const dragCustomMap = new Map();

      collectNormalMarkersInShape(shape, dragVisitSet, dragCustomMap);
      collectOverlapPinsInShape(shape, dragVisitSet, dragCustomMap, { preview: true });

      const finalVisitSet = mode === 'replace'
        ? new Set()
        : new Set(selectedVisitIds.map(String));

      const finalCustomMap = mode === 'replace'
        ? new Map()
        : new Map(selectedCustomItems);

      if (mode === 'subtract') {
        dragVisitSet.forEach(id => finalVisitSet.delete(String(id)));
        dragCustomMap.forEach((detail, id) => finalCustomMap.delete(String(id)));
      } else {
        dragVisitSet.forEach(id => finalVisitSet.add(String(id)));
        dragCustomMap.forEach((detail, id) => finalCustomMap.set(String(id), detail || 1));
      }

      const customPointCnt = [...finalCustomMap.values()]
        .reduce((sum, value) => sum + Number(value || 0), 0);

      return {
        visitCnt: finalVisitSet.size,
        customCnt: finalCustomMap.size,
        customPointCnt
      };
    }

    function updateDragPreview(shape, mode, event, force = false) {
      const now = Date.now();
      if (!force && now - lastDragPreviewAt < 90) return;
      lastDragPreviewAt = now;

      const counts = getPreviewSelectionCounts(shape, mode);
      const total = counts.visitCnt + counts.customCnt;

      if (total <= 0) {
        dragPreview.style.display = 'none';
        return;
      }

      dragPreview.textContent = `${getDragModeLabel(mode)}\n${formatShortCounts(counts)}`;

      dragPreview.style.display = 'block';
      movePreviewTowardMouse(event.clientX, event.clientY);
    }

    function calculatePreviewPosition(mouseX, mouseY) {
      const margin = 14;
      const previewRect = dragPreview.getBoundingClientRect();
      let left = mouseX + margin;
      let top = mouseY + margin;

      if (left + previewRect.width > window.innerWidth - 8) {
        left = mouseX - previewRect.width - margin;
      }

      if (top + previewRect.height > window.innerHeight - 8) {
        top = mouseY - previewRect.height - margin;
      }

      return {
        left: Math.max(8, left),
        top: Math.max(8, top)
      };
    }

    function animatePreviewPosition() {
      if (dragPreview.style.display === 'none') {
        previewAnimationFrame = null;
        return;
      }

      previewCurrentX += (previewTargetX - previewCurrentX) * 0.28;
      previewCurrentY += (previewTargetY - previewCurrentY) * 0.28;

      if (Math.abs(previewTargetX - previewCurrentX) < 0.5) {
        previewCurrentX = previewTargetX;
      }

      if (Math.abs(previewTargetY - previewCurrentY) < 0.5) {
        previewCurrentY = previewTargetY;
      }

      dragPreview.style.left = `${previewCurrentX}px`;
      dragPreview.style.top = `${previewCurrentY}px`;

      if (previewCurrentX === previewTargetX && previewCurrentY === previewTargetY) {
        previewAnimationFrame = null;
        return;
      }

      previewAnimationFrame = window.requestAnimationFrame(animatePreviewPosition);
    }

    function movePreviewTowardMouse(mouseX, mouseY) {
      lastMouseX = mouseX;
      lastMouseY = mouseY;

      const position = calculatePreviewPosition(mouseX, mouseY);
      previewTargetX = position.left;
      previewTargetY = position.top;

      if (!previewHasPosition) {
        previewCurrentX = previewTargetX;
        previewCurrentY = previewTargetY;
        previewHasPosition = true;
        dragPreview.style.left = `${previewCurrentX}px`;
        dragPreview.style.top = `${previewCurrentY}px`;
      }

      if (!previewAnimationFrame) {
        previewAnimationFrame = window.requestAnimationFrame(animatePreviewPosition);
      }
    }

    function hideDragPreview() {
      dragPreview.style.display = 'none';
      previewHasPosition = false;
    }

    function updateLassoPath(closePath = false) {
      if (!lassoPoints.length) {
        lassoPath.setAttribute('d', '');
        return;
      }

      const d = lassoPoints
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

      lassoPath.setAttribute('d', closePath && lassoPoints.length >= 3 ? `${d} Z` : d);
    }

    function resetLasso() {
      lassoPoints = [];
      lassoPath.setAttribute('d', '');
      lassoSvg.style.display = 'none';
    }

    function addLassoPoint(x, y, force = false) {
      const lastPoint = lassoPoints[lassoPoints.length - 1];
      if (!force && lastPoint) {
        const dx = x - lastPoint.x;
        const dy = y - lastPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) < 4) return;
      }

      lassoPoints.push({ x, y });
      updateLassoPath(false);
    }

    function updateSelectionSummaryPreview() {
      if (dragging || !hasSelection()) {
        if (!dragging) {
          dragPreview.style.display = 'none';
        }
        return;
      }

      const counts = getCurrentSelectionCounts();
      dragPreview.textContent = formatShortCounts(counts);
      dragPreview.style.display = 'block';

      if (lastMouseX != null && lastMouseY != null) {
        movePreviewTowardMouse(lastMouseX, lastMouseY);
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      movePreviewTowardMouse(panelRect.left, panelRect.top);
    }

    async function applySelection(shape, mode = 'replace') {
      const dragVisitSet = new Set();
      const dragCustomMap = new Map();

      selectedOverlapCount = 0;
      unresolvedOverlapCount = 0;

      countEl.textContent = `${getDragModeLabel(mode)} 처리 중...`;

      collectNormalMarkersInShape(shape, dragVisitSet, dragCustomMap);
      collectOverlapPinsInShape(shape, dragVisitSet, dragCustomMap);

      const finalVisitSet = mode === 'replace'
        ? new Set()
        : new Set(selectedVisitIds.map(String));

      const finalCustomMap = mode === 'replace'
        ? new Map()
        : new Map(selectedCustomItems);

      if (mode === 'subtract') {
        dragVisitSet.forEach(id => {
          finalVisitSet.delete(String(id));
        });

        dragCustomMap.forEach((detail, id) => {
          finalCustomMap.delete(String(id));
        });
      } else {
        dragVisitSet.forEach(id => {
          finalVisitSet.add(String(id));
        });

        dragCustomMap.forEach((detail, id) => {
          finalCustomMap.set(String(id), detail || 1);
        });
      }

      selectedVisitIds = [...finalVisitSet];
      selectedCustomItems = finalCustomMap;

      writeSelectionToPage();
      markFinalSelectionVisuals();
      updatePanel();
      scheduleSelectionVisualRefresh(250);
      scheduleSelectionVisualRefresh(700);

      log(`${getDragModeLabel(mode)} 완료`);
      log('이번 드래그 방문:', [...dragVisitSet]);
      log('이번 드래그 맞춤:', [...dragCustomMap.entries()]);
      log('최종 선택 방문:', selectedVisitIds);
      log('최종 선택 맞춤:', [...selectedCustomItems.entries()]);
      log('selectMarkerList:', W.selectMarkerList);
      log('selectCustomMarkerList:', W.selectCustomMarkerList);

      if (unresolvedOverlapCount > 0) {
        alert(
          `겹침핀 ${unresolvedOverlapCount}개는 일부 예약번호를 찾지 못했습니다.\n\n` +
          `새로고침 후 조회 버튼을 다시 누른 다음 테스트해 주세요.\n` +
          `오른쪽 아래 좌표 인덱스가 방문/맞춤 모두 0이면 아직 데이터 인덱스가 비어 있습니다.`
        );
      }
    }

    function applyPointSelection(event, mode = 'replace') {
      const pointVisitSet = new Set();
      const pointCustomMap = new Map();

      selectedOverlapCount = 0;
      unresolvedOverlapCount = 0;

      const found = collectPointSelection(
        event.clientX,
        event.clientY,
        pointVisitSet,
        pointCustomMap
      );

      if (!found) {
        log('우클릭 위치에서 선택할 핀을 찾지 못했습니다.');
        return false;
      }

      const finalVisitSet = mode === 'replace'
        ? new Set()
        : new Set(selectedVisitIds.map(String));

      const finalCustomMap = mode === 'replace'
        ? new Map()
        : new Map(selectedCustomItems);

      if (mode === 'subtract') {
        pointVisitSet.forEach(id => finalVisitSet.delete(String(id)));
        pointCustomMap.forEach((detail, id) => finalCustomMap.delete(String(id)));
      } else {
        pointVisitSet.forEach(id => finalVisitSet.add(String(id)));
        pointCustomMap.forEach((detail, id) => finalCustomMap.set(String(id), detail || 1));
      }

      selectedVisitIds = [...finalVisitSet];
      selectedCustomItems = finalCustomMap;

      writeSelectionToPage();
      markFinalSelectionVisuals();
      updatePanel();
      scheduleSelectionVisualRefresh(250);
      scheduleSelectionVisualRefresh(700);

      log(`${getDragModeLabel(mode)} 우클릭 선택 완료`);
      log('이번 우클릭 방문:', [...pointVisitSet]);
      log('이번 우클릭 맞춤:', [...pointCustomMap.entries()]);
      log('최종 선택 방문:', selectedVisitIds);
      log('최종 선택 맞춤:', [...selectedCustomItems.entries()]);

      if (unresolvedOverlapCount > 0) {
        alert(
          `겹침핀 ${unresolvedOverlapCount}개는 일부 예약번호를 찾지 못했습니다.\n\n` +
          `새로고침 후 조회 버튼을 다시 누른 다음 테스트해 주세요.`
        );
      }

      return true;
    }

    function openBatchDispatchWindow() {
      writeSelectionToPage();

      if (!selectedVisitIds.length && !selectedCustomItems.size) {
        alert('선택된 대상이 없습니다.');
        return;
      }

      if (typeof W.fnSelectCompleteBatchDispatch === 'function') {
        W.fnSelectCompleteBatchDispatch('select');
      } else if (typeof W.fnOpenModalCaralcChange === 'function') {
        W.fnOpenModalCaralcChange();
      } else {
        alert('일괄배차 모달 함수를 찾지 못했습니다. 기존 화면의 선택 일괄배차 버튼을 직접 눌러보세요.');
        log('selectMarkerList:', W.selectMarkerList);
        log('selectCustomMarkerList:', W.selectCustomMarkerList);
      }
    }

    async function openTongDispatchWindow() {
      const mapArea = getMapArea();

      if (!mapArea) {
        alert('지도 영역을 찾지 못했습니다.');
        return;
      }

      const rect = mapArea.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        alert('지도 영역이 보이지 않습니다.');
        return;
      }

      await applySelection(rect, 'replace');
      openBatchDispatchWindow();
    }

    document.addEventListener('contextmenu', event => {
      const mapArea = getMapArea();

      if (mapArea && mapArea.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    document.addEventListener('mousedown', event => {
      if (event.button !== 2) return;

      const mapArea = getMapArea();
      if (!mapArea || !mapArea.contains(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      dragging = true;
      startX = event.clientX;
      startY = event.clientY;

      currentDragMode = getDragMode(event);
      styleSelectBoxByMode(currentDragMode);

      if (selectionMode === 'lasso') {
        selectBox.style.display = 'none';
        lassoSvg.style.display = 'block';
        lassoPoints = [];
        addLassoPoint(startX, startY, true);
      } else {
        resetLasso();
        selectBox.style.left = `${startX}px`;
        selectBox.style.top = `${startY}px`;
        selectBox.style.width = '0px';
        selectBox.style.height = '0px';
        selectBox.style.display = 'block';
      }
      hideDragPreview();

      if (W.map && typeof W.map.setDraggable === 'function') {
        W.map.setDraggable(false);
      }
    }, true);

    document.addEventListener('mousemove', event => {
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;

      if (!isMapDispatchModalVisible()) {
        resetWhenMapModalClosed();
        return;
      }

      if (!dragging) {
        if (hasSelection()) {
          updateSelectionSummaryPreview();
        }
        return;
      }

      if (selectionMode === 'lasso') {
        addLassoPoint(event.clientX, event.clientY);
        updateDragPreview({ type: 'polygon', points: lassoPoints }, currentDragMode, event);
      } else {
        const rect = normalizeRect(startX, startY, event.clientX, event.clientY);

        selectBox.style.left = `${rect.left}px`;
        selectBox.style.top = `${rect.top}px`;
        selectBox.style.width = `${rect.width}px`;
        selectBox.style.height = `${rect.height}px`;

        updateDragPreview(rect, currentDragMode, event);
      }
    }, true);

    document.addEventListener('mouseup', async event => {
      if (!dragging || event.button !== 2) return;

      dragging = false;

      const rect = normalizeRect(startX, startY, event.clientX, event.clientY);
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      const shape = selectionMode === 'lasso'
        ? { type: 'polygon', points: [...lassoPoints] }
        : rect;
      selectBox.style.display = 'none';
      resetLasso();

      if (W.map && typeof W.map.setDraggable === 'function') {
        W.map.setDraggable(true);
      }

      if (moved <= RIGHT_CLICK_POINT_THRESHOLD) {
        applyPointSelection(event, currentDragMode);
        updateSelectionSummaryPreview();
        return;
      }

      await applySelection(shape, currentDragMode);
      updateSelectionSummaryPreview();
    }, true);

    window.setInterval(resetWhenMapModalClosed, 500);

    panel.querySelector('#kerc-helper-clear').addEventListener('click', clearSelection);
    openButton.addEventListener('click', openBatchDispatchWindow);
    tongButton.addEventListener('click', openTongDispatchWindow);
    collapseButton.addEventListener('click', () => {
      setPanelCollapsed(!isPanelCollapsed);
    });
    settingsButton.addEventListener('click', () => {
      if (isPanelCollapsed) {
        setPanelCollapsed(false);
      }
      settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none';
    });
    ciImg.addEventListener('error', () => {
      ciImg.style.display = 'none';
      warn('CI 이미지를 불러오지 못했습니다:', CI_IMAGE_URL);
    });
    if (selectionModeSelect) {
      selectionModeSelect.value = selectionMode;
      selectionModeSelect.addEventListener('change', () => {
        selectionMode = selectionModeSelect.value === 'lasso' ? 'lasso' : 'rect';
        resetLasso();
        selectBox.style.display = 'none';
        log('선택 방식 변경:', selectionMode === 'lasso' ? '올가미' : '블록');
      });
    }
    selectedColorInput.addEventListener('input', () => {
      setSelectedColor(selectedColorInput.value);
      updateSelectedColorUi();
      refreshSelectionVisuals();
    });
    selectedColorInput.addEventListener('change', () => {
      log('선택 핀 강조 색상 변경:', getSelectedColor());
    });

    function bindShortcutCapture(input, setter, getter, label, defaultValue) {
      input.addEventListener('focus', () => {
        input.value = '키를 누르세요...';
        input.style.borderColor = '#2563eb';
        input.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.16)';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = '#cbd5e1';
        input.style.boxShadow = '';
        input.value = getShortcutLabel(getter());
      });

      input.addEventListener('keydown', event => {
        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }

        if (event.key === 'Escape') {
          input.blur();
          return;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
          setter(defaultValue);
          updateShortcutUi();
          input.blur();
          log(`${label} 단축키 기본값 복원:`, getShortcutLabel(defaultValue));
          return;
        }

        const shortcut = getShortcutFromEvent(event);
        if (!shortcut) return;

        setter(shortcut);
        updateShortcutUi();
        input.blur();
        log(`${label} 단축키 변경:`, getShortcutLabel(shortcut));
      });
    }

    bindShortcutCapture(
      shortcutSelect,
      setBatchDispatchShortcut,
      getBatchDispatchShortcut,
      '일괄배차',
      'F2'
    );
    bindShortcutCapture(
      tongShortcutSelect,
      setTongDispatchShortcut,
      getTongDispatchShortcut,
      '통배차',
      'F8'
    );
    bindShortcutCapture(
      clearShortcutSelect,
      setClearShortcut,
      getClearShortcut,
      '초기화',
      'QSE'
    );

    function installMapVisualRefreshHooks() {
      if (W.__KERC_VISUAL_REFRESH_HOOKS_INSTALLED__) return;
      W.__KERC_VISUAL_REFRESH_HOOKS_INSTALLED__ = true;

      const observer = new MutationObserver(() => {
        scheduleSelectionVisualRefresh();
      });

      const mapArea = getMapArea();
      if (mapArea) {
        observer.observe(mapArea, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'src', 'title', 'data-id']
        });
      }

      if (W.kakao && W.kakao.maps && W.kakao.maps.event && W.map) {
        ['zoom_changed', 'dragend', 'bounds_changed', 'idle', 'tilesloaded'].forEach(eventName => {
          try {
            W.kakao.maps.event.addListener(W.map, eventName, () => {
              scheduleSelectionVisualRefresh();
              scheduleSelectionVisualRefresh(300);
            });
          } catch (error) {
            warn(`지도 이벤트 훅 실패: ${eventName}`, error);
          }
        });
      }

      window.setInterval(refreshSelectionVisuals, 1000);
      log('선택 강조 유지 훅 설치 완료');
    }

    function installF2Shortcut() {
      if (W.__KERC_F2_SHORTCUT_INSTALLED__) return;
      W.__KERC_F2_SHORTCUT_INSTALLED__ = true;

      let lastRunAt = 0;

      function isBatchDispatchModalOpen() {
        const modal = document.querySelector('#modal_select_batch_dispatch');
        if (!modal) return false;

        const style = getComputedStyle(modal);
        const rect = modal.getBoundingClientRect();

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      }

      function isTextEditing() {
        const active = document.activeElement;
        if (!active) return false;

        const tag = active.tagName
          ? active.tagName.toLowerCase()
          : '';

        return tag === 'textarea' || active.isContentEditable;
      }

      function runQseClearShortcut(event) {
        if (event.type !== 'keydown') return;
        if (getClearShortcut() !== 'QSE') return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (isTextEditing()) return;

        const active = document.activeElement;
        const activeTag = active && active.tagName
          ? active.tagName.toLowerCase()
          : '';

        if (activeTag === 'input' || activeTag === 'select') return;

        const key = String(event.key || '').toUpperCase();
        if (!/^[QSE]$/.test(key)) return;

        const now = Date.now();
        if (now - lastQseKeyAt > 900) {
          qseBuffer = '';
        }

        lastQseKeyAt = now;
        qseBuffer = `${qseBuffer}${key}`.slice(-3);

        if (qseBuffer === 'QSE') {
          event.preventDefault();
          event.stopPropagation();

          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }

          qseBuffer = '';
          clearSelection();
          log('QSE 초기화 단축키 실행');
        }
      }

      async function runShortcut(event) {
        const isTongShortcut = isConfiguredTongShortcut(event);
        const isBatchShortcut = isConfiguredBatchShortcut(event);
        const clearShortcut = getClearShortcut();
        const isClearShortcut = clearShortcut !== 'QSE' && isShortcutEvent(event, clearShortcut);

        if (!isTongShortcut && !isBatchShortcut && !isClearShortcut) return;

        if (isBatchDispatchModalOpen()) {
          log('단축키 무시: 일괄배차 모달이 이미 열려 있음');
          return;
        }

        if (isTextEditing()) {
          log('단축키 무시: textarea 또는 contenteditable 포커스');
          return;
        }

        const now = Date.now();
        if (now - lastRunAt < 600) return;
        lastRunAt = now;

        if (isClearShortcut) {
          event.preventDefault();
          event.stopPropagation();

          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }

          clearSelection();
          log(`${getShortcutLabel(clearShortcut)} 초기화 단축키 실행`);
          return;
        }

        const btn = isTongShortcut
          ? document.querySelector('#kerc-helper-tong')
          : document.querySelector('#kerc-helper-open');

        if (!btn) {
          log('단축키 감지: 버튼 없음');
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }

        if (isTongShortcut) {
          log(`${getShortcutLabel(getTongDispatchShortcut())} 통배차 단축키 감지: 실행`);
          await openTongDispatchWindow();
        } else {
          log(`${getShortcutLabel(getBatchDispatchShortcut())} 일괄배차 단축키 감지: 버튼 클릭 실행`);
          btn.click();
        }
      }

      document.addEventListener('keydown', runShortcut, true);
      window.addEventListener('keydown', runShortcut, true);
      W.addEventListener('keydown', runShortcut, true);
      document.addEventListener('keydown', runQseClearShortcut, true);
      window.addEventListener('keydown', runQseClearShortcut, true);
      W.addEventListener('keydown', runQseClearShortcut, true);

      document.addEventListener('keyup', runShortcut, true);
      window.addEventListener('keyup', runShortcut, true);
      W.addEventListener('keyup', runShortcut, true);

      if (document.documentElement) {
        document.documentElement.addEventListener('keydown', runShortcut, true);
        document.documentElement.addEventListener('keyup', runShortcut, true);
      }

      if (document.body) {
        document.body.addEventListener('keydown', runShortcut, true);
        document.body.addEventListener('keyup', runShortcut, true);
      }

      log('단축키 설치 완료:', {
        batch: getShortcutLabel(getBatchDispatchShortcut()),
        tong: getShortcutLabel(getTongDispatchShortcut())
      });
    }

    installF2Shortcut();
    installMapVisualRefreshHooks();
  }

  installAjaxCapture();
  startWhenReady();
})();
