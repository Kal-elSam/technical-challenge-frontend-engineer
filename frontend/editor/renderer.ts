// Canvas viewport renderer. Draws only the cells visible inside the current
// pan/zoom window, never the full grid — this is what keeps 1000x1000 (1M
// cells) as cheap to paint as 10x10, since visible cell count is bounded by
// canvas size / cellSize, not by document size.

import { ICON_DETAIL_MIN_PX, renderDetailedCell, renderFlatCell } from "./cell-paint.ts";
import { CELL_RGB } from "./colors.ts";
import { CellKind, type LevelDocument, getCell, indexOf, contentBounds } from "./level-model.ts";

export type Viewport = {
  /** Doc-space cell coordinate at the canvas's top-left corner. */
  originX: number;
  originY: number;
  /** CSS pixels per cell. */
  cellSize: number;
};

export type CellBounds = {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
};

// Below this cell size, per-cell fillRect calls stop paying off (thousands of
// draw calls for a screen's worth of cells); switch to a pixel-buffer blit.
const LOW_ZOOM_CELL_PX = 3;

export function screenToCell(viewport: Viewport, sx: number, sy: number): { x: number; y: number } {
  return {
    x: Math.floor(viewport.originX + sx / viewport.cellSize),
    y: Math.floor(viewport.originY + sy / viewport.cellSize),
  };
}

export function cellToScreen(viewport: Viewport, cx: number, cy: number): { x: number; y: number } {
  return {
    x: (cx - viewport.originX) * viewport.cellSize,
    y: (cy - viewport.originY) * viewport.cellSize,
  };
}

export function visibleBounds(
  doc: LevelDocument,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number,
): CellBounds {
  const colStart = Math.max(0, Math.floor(viewport.originX));
  const colEnd = Math.min(doc.width, Math.ceil(viewport.originX + canvasWidth / viewport.cellSize));
  const rowStart = Math.max(0, Math.floor(viewport.originY));
  const rowEnd = Math.min(doc.height, Math.ceil(viewport.originY + canvasHeight / viewport.cellSize));
  return { colStart, colEnd, rowStart, rowEnd };
}

/** Zooms so the doc-space point under (sx, sy) stays under (sx, sy). Pure —
 * callers are expected to clamp the result against document bounds. */
export function zoomViewport(viewport: Viewport, sx: number, sy: number, factor: number): Viewport {
  const before = screenToCell(viewport, sx, sy);
  const cellSize = viewport.cellSize * factor;
  return { cellSize, originX: before.x - sx / cellSize, originY: before.y - sy / cellSize };
}

/** Pans by a screen-space delta. Pure — see `zoomViewport`. */
export function panViewport(viewport: Viewport, dx: number, dy: number): Viewport {
  return {
    ...viewport,
    originX: viewport.originX + dx / viewport.cellSize,
    originY: viewport.originY + dy / viewport.cellSize,
  };
}

export type ViewportOriginBounds = {
  minOriginX: number;
  maxOriginX: number;
  minOriginY: number;
  maxOriginY: number;
};

/** Valid origin range for a viewport. When the document is smaller than the
 * visible area, min origin is negative so the board can be centered instead of
 * hugging the top-left corner. */
export function viewportOriginBounds(
  doc: LevelDocument,
  cellSize: number,
  canvasWidth: number,
  canvasHeight: number,
): ViewportOriginBounds {
  const visibleCellsX = canvasWidth / cellSize;
  const visibleCellsY = canvasHeight / cellSize;
  return {
    minOriginX: Math.min(0, doc.width - visibleCellsX),
    maxOriginX: Math.max(0, doc.width - visibleCellsX),
    minOriginY: Math.min(0, doc.height - visibleCellsY),
    maxOriginY: Math.max(0, doc.height - visibleCellsY),
  };
}

/** Zoom-to-fit with the document centered in the canvas when it does not fill
 * the viewport. Uses the tight content bbox when present so padded void
 * columns/rows in the ascii art do not pull the maze off-center. */
export function fitViewportToDocument(doc: LevelDocument, canvasWidth: number, canvasHeight: number): Viewport {
  const bounds = contentBounds(doc);
  const colStart = bounds?.colStart ?? 0;
  const colEnd = bounds?.colEnd ?? doc.width;
  const rowStart = bounds?.rowStart ?? 0;
  const rowEnd = bounds?.rowEnd ?? doc.height;
  const contentWidth = colEnd - colStart;
  const contentHeight = rowEnd - rowStart;

  const minCellSize = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight, 64);
  const cellSize = Math.max(1, minCellSize);
  const visibleCellsX = canvasWidth / cellSize;
  const visibleCellsY = canvasHeight / cellSize;
  return clampViewport(
    {
      cellSize,
      originX: colStart + (contentWidth - visibleCellsX) / 2,
      originY: rowStart + (contentHeight - visibleCellsY) / 2,
    },
    doc,
    canvasWidth,
    canvasHeight,
  );
}

/** Clamps a viewport so it never pans/zooms past the document edges. */
export function clampViewport(
  viewport: Viewport,
  doc: LevelDocument,
  canvasWidth: number,
  canvasHeight: number,
): Viewport {
  const minCellSize = Math.min(canvasWidth / doc.width, canvasHeight / doc.height, 64);
  const cellSize = Math.min(64, Math.max(minCellSize, viewport.cellSize));
  const { minOriginX, maxOriginX, minOriginY, maxOriginY } = viewportOriginBounds(doc, cellSize, canvasWidth, canvasHeight);
  return {
    cellSize,
    originX: Math.min(Math.max(minOriginX, viewport.originX), maxOriginX),
    originY: Math.min(Math.max(minOriginY, viewport.originY), maxOriginY),
  };
}

function renderPerCell(
  ctx: CanvasRenderingContext2D,
  doc: LevelDocument,
  viewport: Viewport,
  bounds: CellBounds,
): void {
  const { cellSize } = viewport;
  const detailed = cellSize >= ICON_DETAIL_MIN_PX;

  for (let y = bounds.rowStart; y < bounds.rowEnd; y++) {
    for (let x = bounds.colStart; x < bounds.colEnd; x++) {
      const kind = getCell(doc, x, y);
      const { x: sx, y: sy } = cellToScreen(viewport, x, y);
      // Round up so adjacent cells never leave a 1px seam from rounding.
      const left = Math.floor(sx);
      const top = Math.floor(sy);
      const w = Math.ceil(sx + cellSize) - left;
      const h = Math.ceil(sy + cellSize) - top;

      if (detailed) {
        renderDetailedCell(ctx, doc, kind, x, y, left, top, w, h, cellSize);
      } else {
        renderFlatCell(ctx, kind, left, top, w, h);
      }
    }
  }
}

/** Reused across frames so the hot path (pan/zoom/paint) never allocates. */
export function createRenderer(): { render: (ctx: CanvasRenderingContext2D, doc: LevelDocument, viewport: Viewport, canvasWidth: number, canvasHeight: number) => void } {
  let offscreen: OffscreenCanvas | HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let pixelBuffer: ImageData | null = null;
  let pixelBufferCols = 0;
  let pixelBufferRows = 0;

  function getOffscreen(width: number, height: number): CanvasRenderingContext2D {
    if (offscreen === null || offscreen.width !== width || offscreen.height !== height) {
      offscreen =
        typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      offscreenCtx = offscreen.getContext("2d") as CanvasRenderingContext2D;
    }
    if (offscreenCtx === null) {
      throw new Error("2d context unavailable for offscreen canvas");
    }
    return offscreenCtx;
  }

  function getPixelBuffer(bufferCtx: CanvasRenderingContext2D, cols: number, rows: number): ImageData {
    if (pixelBuffer === null || pixelBufferCols !== cols || pixelBufferRows !== rows) {
      pixelBuffer = bufferCtx.createImageData(cols, rows);
      pixelBufferCols = cols;
      pixelBufferRows = rows;
    }
    return pixelBuffer;
  }

  function renderBuffered(
    ctx: CanvasRenderingContext2D,
    doc: LevelDocument,
    viewport: Viewport,
    bounds: CellBounds,
  ): void {
    const cols = bounds.colEnd - bounds.colStart;
    const rows = bounds.rowEnd - bounds.rowStart;
    if (cols <= 0 || rows <= 0) {
      return;
    }

    const bufferCtx = getOffscreen(cols, rows);
    const image = getPixelBuffer(bufferCtx, cols, rows);
    const pixels = image.data;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const docX = bounds.colStart + x;
        const docY = bounds.rowStart + y;
        const kind = doc.cells[indexOf(doc, docX, docY)] as CellKind;
        const [r, g, b] = CELL_RGB[kind];
        const p = (y * cols + x) * 4;
        pixels[p] = r;
        pixels[p + 1] = g;
        pixels[p + 2] = b;
        pixels[p + 3] = 255;
      }
    }
    bufferCtx.putImageData(image, 0, 0);

    const dest = cellToScreen(viewport, bounds.colStart, bounds.rowStart);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      offscreen as CanvasImageSource,
      0,
      0,
      cols,
      rows,
      Math.floor(dest.x),
      Math.floor(dest.y),
      cols * viewport.cellSize,
      rows * viewport.cellSize,
    );
  }

  function render(
    ctx: CanvasRenderingContext2D,
    doc: LevelDocument,
    viewport: Viewport,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const bounds = visibleBounds(doc, viewport, canvasWidth, canvasHeight);
    if (viewport.cellSize < LOW_ZOOM_CELL_PX) {
      renderBuffered(ctx, doc, viewport, bounds);
    } else {
      renderPerCell(ctx, doc, viewport, bounds);
    }
  }

  return { render };
}
