// Editor-owned level model: compact typed arrays instead of Board/BlockValue
// objects, so 1000x1000 (1M cells) stays cheap to allocate, mutate, and copy.
// This intentionally does not reuse `frontend/game/engine/board.ts` — the
// engine's Board is immutable and object-per-cell, which is the wrong shape
// for an editor that mutates single cells at 60fps during a drag.
//
// Wire format (must match frontend/game/engine/ascii2d.ts exactly):
//   "##" wall   "  " empty   ". " pellet   "O " power pellet
//   "P<D>" player spawn   "G<D>" ghost spawn   <D> in U/D/L/R

export const CellKind = {
  Empty: 0,
  Wall: 1,
  Pellet: 2,
  PowerPellet: 3,
  Player: 4,
  Ghost: 5,
} as const;

export type CellKind = (typeof CellKind)[keyof typeof CellKind];

export const SpawnDirection = {
  Up: 0,
  Right: 1,
  Down: 2,
  Left: 3,
} as const;

export type SpawnDirection = (typeof SpawnDirection)[keyof typeof SpawnDirection];

const DIR_TO_CHAR: Record<SpawnDirection, string> = {
  [SpawnDirection.Up]: "U",
  [SpawnDirection.Right]: "R",
  [SpawnDirection.Down]: "D",
  [SpawnDirection.Left]: "L",
};

const CHAR_TO_DIR: Record<string, SpawnDirection> = {
  U: SpawnDirection.Up,
  R: SpawnDirection.Right,
  D: SpawnDirection.Down,
  L: SpawnDirection.Left,
};

export type LevelDocument = {
  id: string | null;
  version: number | null;
  width: number;
  height: number;
  cells: Uint8Array;
  directions: Uint8Array;
};

export function createEmptyDocument(width: number, height: number): LevelDocument {
  const total = width * height;
  return {
    id: null,
    version: null,
    width,
    height,
    cells: new Uint8Array(total),
    directions: new Uint8Array(total),
  };
}

export function indexOf(doc: LevelDocument, x: number, y: number): number {
  return y * doc.width + x;
}

export function isInBounds(doc: LevelDocument, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < doc.width && y < doc.height;
}

export function getCell(doc: LevelDocument, x: number, y: number): CellKind {
  return doc.cells[indexOf(doc, x, y)] as CellKind;
}

export function getDirection(doc: LevelDocument, x: number, y: number): SpawnDirection {
  return doc.directions[indexOf(doc, x, y)] as SpawnDirection;
}

// SpawnDirection.Up is 0, matching Uint8Array's zero-init value. Cells whose
// kind has no direction (Empty/Wall/Pellet/PowerPellet) always store this
// value, so an explicitly-parsed cell and a zero-initialized padding cell of
// the same kind are byte-identical — required for the round-trip tests and
// for treating `directions` as safely ignorable outside spawn cells.
const NO_DIRECTION = SpawnDirection.Up;

export function setCell(
  doc: LevelDocument,
  x: number,
  y: number,
  kind: CellKind,
  direction: SpawnDirection = NO_DIRECTION,
): void {
  const idx = indexOf(doc, x, y);
  doc.cells[idx] = kind;
  doc.directions[idx] = direction;
}

/** Parses ascii2d text into a fresh compact document. Mirrors the parsing
 * rules of `fromAscii2d` in the engine: rows split on "\n", short rows pad
 * with empty, the max (even) row length in chars sets the board width. */
export function parseAscii2d(text: string): LevelDocument {
  const trimmed = text.replace(/^\n/, "");
  const lines = trimmed.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("ascii2d text has no rows");
  }

  const maxLineLen = Math.max(...lines.map((line) => line.length));
  if (maxLineLen % 2 !== 0) {
    throw new Error("Bad line length: ascii2d rows must be an even number of characters");
  }
  const width = maxLineLen / 2;
  const height = lines.length;

  const doc = createEmptyDocument(width, height);

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row] ?? "";
    const chars = [...line];
    let col = 0;
    let charIndex = 0;
    while (charIndex < chars.length) {
      const first = chars[charIndex];
      const second = chars[charIndex + 1];
      charIndex += 2;
      if (first === undefined) {
        break;
      }
      if (second === undefined) {
        throw new Error(`Blocks should be in pairs: ${first} at row ${row}`);
      }
      const parsed = parseTokenPair(first, second, row);
      setCell(doc, col, row, parsed.kind, parsed.direction);
      col += 1;
    }
    // Short rows already default to Empty (Uint8Array zero-init).
  }

  return doc;
}

function parseTokenPair(
  first: string,
  second: string,
  row: number,
): { kind: CellKind; direction: SpawnDirection } {
  if (first === " " && second === " ") {
    return { kind: CellKind.Empty, direction: NO_DIRECTION };
  }
  if (first === "#" && second === "#") {
    return { kind: CellKind.Wall, direction: NO_DIRECTION };
  }
  if (first === "." && second === " ") {
    return { kind: CellKind.Pellet, direction: NO_DIRECTION };
  }
  if (first === "O" && second === " ") {
    return { kind: CellKind.PowerPellet, direction: NO_DIRECTION };
  }
  if (first === "P" && second in CHAR_TO_DIR) {
    return { kind: CellKind.Player, direction: CHAR_TO_DIR[second]! };
  }
  if (first === "G" && second in CHAR_TO_DIR) {
    return { kind: CellKind.Ghost, direction: CHAR_TO_DIR[second]! };
  }
  throw new Error(`Bad block (${first}, ${second}) at row ${row}`);
}

function tokenFor(kind: CellKind, direction: SpawnDirection): string {
  switch (kind) {
    case CellKind.Empty:
      return "  ";
    case CellKind.Wall:
      return "##";
    case CellKind.Pellet:
      return ". ";
    case CellKind.PowerPellet:
      return "O ";
    case CellKind.Player:
      return "P" + DIR_TO_CHAR[direction];
    case CellKind.Ghost:
      return "G" + DIR_TO_CHAR[direction];
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled cell kind: ${String(exhaustive)}`);
    }
  }
}

/** Serializes every token kind, always emitting full-width rows (including
 * trailing spaces) so the result round-trips through `fromAscii2d`. */
export function serializeToAscii2d(doc: LevelDocument): string {
  const rows: string[] = [];
  for (let y = 0; y < doc.height; y++) {
    let row = "";
    for (let x = 0; x < doc.width; x++) {
      const idx = indexOf(doc, x, y);
      row += tokenFor(doc.cells[idx] as CellKind, doc.directions[idx] as SpawnDirection);
    }
    rows.push(row);
  }
  return "\n" + rows.join("\n") + "\n";
}

export function cloneDocument(doc: LevelDocument): LevelDocument {
  return {
    id: doc.id,
    version: doc.version,
    width: doc.width,
    height: doc.height,
    cells: doc.cells.slice(),
    directions: doc.directions.slice(),
  };
}
