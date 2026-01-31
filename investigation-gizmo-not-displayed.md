# TransformControls ギズモが表示されない問題の調査結果

## 概要

テキストや矢印のアノテーションをクリックして選択しても、稀に TransformControls の移動ギズモが表示されないことがある。発生条件は不確定。

## 考えられる原因（可能性の高い順）

### 1. `isDraggingGizmo` フラグが `true` のまま固着する

**該当箇所**: `src/main.js` 549〜552行目、652行目

`dragging-changed` イベントで `isDraggingGizmo` を管理しているが、ギズモをドラッグ中にマウスカーソルがブラウザウィンドウ外に出たり、フォーカスが外れたりすると、`false` に戻すイベントが発火しない可能性がある。

この状態になると `mouseup` ハンドラの652行目（`if (isDraggingGizmo) return;`）で毎回早期リターンし、以降すべての選択操作が無視される。

**症状の特徴**: 一度発生するとリロードするまで直らない。

### 2. クリック判定の閾値が厳しい

**該当箇所**: `src/main.js` 654〜655行目

```js
const dist = new THREE.Vector2(event.clientX, event.clientY).distanceTo(mouseDownPos);
const isClick = dist < 5;
```

クリック判定を5ピクセル未満で行っている。マウスを押してから離すまでに無意識に5ピクセル以上動くとクリックと判定されず、選択処理がスキップされる。高DPIマウスやペン入力では起きやすい。

**症状の特徴**: 単発で発生し、再度クリックすると正常に動作する。

### 3. 細い矢印へのレイキャストが外れる

**該当箇所**: `src/main.js` 568〜584行目（`checkIntersection` 関数）

矢印の軸（`CylinderGeometry`）のような細いオブジェクトに対しては、レイキャストの判定がピクセル単位の精度を要求するため、見た目上はクリックしていても判定が外れて `null` が返り、`deselectObject()` が呼ばれることがある。

**症状の特徴**: 矢印の選択で発生しやすい。テキストスプライトでは起きにくい。

### 4. ギズモを掴み損ねると選択解除される

**該当箇所**: `src/main.js` 686〜694行目

ギズモが表示された状態でギズモの軸をクリックし損ねると、`isDraggingGizmo` は `false` のまま、`checkIntersection` は `drawnObjects` のみを検索するためギズモにはヒットせず、`deselectObject()` で選択解除されてしまう。

**症状の特徴**: ギズモ表示中に操作しようとして消えてしまう。

## 修正案

| 原因 | 修正方針 |
|------|----------|
| 1. フラグ固着 | `mouseup` で `isDraggingGizmo` を強制的に `false` にリセットする、または `pointerup`/`blur` イベントでフラグをリセットする |
| 2. クリック閾値 | 閾値を `5` から `10` 程度に緩和する |
| 3. レイキャスト精度 | `Raycaster.params.Line.threshold` や `Raycaster.params.Mesh.threshold` を調整して当たり判定を広げる |
| 4. ギズモ掴み損ね | ギズモ表示中にレイキャストがヒットしなかった場合、即座に `deselectObject()` を呼ばず現在の選択を維持する |
