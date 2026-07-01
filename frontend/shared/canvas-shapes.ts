// Angle-based cell iconography shared by the editor and the game.

export function drawWallCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const edge = Math.max(1, h * 0.14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(x, y, w, edge);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(x, y + h - edge, w, edge);
}

export function drawPellet(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, cellSize * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPowerPellet(ctx: CanvasRenderingContext2D, cx: number, cy: number, cellSize: number, color: string): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = cellSize * 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPacManWedge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  mouthCenterAngle: number,
  mouthHalfAngle: number,
  color: string,
): void {
  const radius = cellSize * 0.42;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, mouthCenterAngle + mouthHalfAngle, mouthCenterAngle - mouthHalfAngle + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  lookAngle: number,
  color: string,
): void {
  const radius = cellSize * 0.36;
  const domeCenterY = cy - radius * 0.1;
  const bottomY = domeCenterY + radius;
  const legs = 4;
  const legWidth = (radius * 2) / legs;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, domeCenterY, radius, Math.PI, 0, false);
  ctx.lineTo(cx + radius, bottomY);
  for (let i = 0; i < legs; i++) {
    const outerX = cx + radius - legWidth * i;
    const innerX = outerX - legWidth / 2;
    const nextX = outerX - legWidth;
    const dipY = i % 2 === 0 ? bottomY - legWidth * 0.6 : bottomY;
    ctx.lineTo(innerX, dipY);
    ctx.lineTo(nextX, bottomY);
  }
  ctx.closePath();
  ctx.fill();

  const eyeOffsetX = radius * 0.34;
  const eyeY = domeCenterY - radius * 0.05;
  const eyeRadius = radius * 0.22;
  const pupilOffset = eyeRadius * 0.45;
  const pupilDx = Math.cos(lookAngle) * pupilOffset;
  const pupilDy = Math.sin(lookAngle) * pupilOffset;

  for (const side of [-1, 1]) {
    const eyeX = cx + side * eyeOffsetX;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16213e";
    ctx.beginPath();
    ctx.arc(eyeX + pupilDx, eyeY + pupilDy, eyeRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}
