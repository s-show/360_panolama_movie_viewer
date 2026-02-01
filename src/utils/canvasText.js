/**
 * テキストをCanvasに描画し、そのCanvasとbaseScaleを返す共通処理。
 * createTextSprite と updateTextSpriteContent の重複ロジックを統合。
 */
export function drawTextToCanvas(text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = 64;
  const strokeWidth = 4;
  const padding = 20;
  const margin = strokeWidth / 2 + padding;
  context.font = `bold ${fontSize}px Arial, sans-serif`;

  const metrics = context.measureText(text);
  const bboxLeft = metrics.actualBoundingBoxLeft;
  const bboxRight = metrics.actualBoundingBoxRight;
  const bboxAscent = metrics.actualBoundingBoxAscent;
  const bboxDescent = metrics.actualBoundingBoxDescent;

  canvas.width = bboxLeft + bboxRight + margin * 2;
  canvas.height = bboxAscent + bboxDescent + margin * 2;

  context.font = `bold ${fontSize}px Arial, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  const drawX = margin + bboxLeft;
  const drawY = margin + bboxAscent;

  context.lineWidth = strokeWidth;
  context.strokeStyle = "rgba(0, 0, 0, 0.8)";
  context.strokeText(text, drawX, drawY);

  context.fillStyle = color;
  context.fillText(text, drawX, drawY);

  return { canvas };
}
