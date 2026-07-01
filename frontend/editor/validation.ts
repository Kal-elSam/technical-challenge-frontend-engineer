// Structural checks surfaced in the validation panel. Kept separate from
// level-model.ts (parsing/serialization) since this is a distinct concern:
// a document can be perfectly well-formed and still be an unplayable level.

import { CellKind, type LevelDocument } from "./level-model.ts";

export type ValidationIssue = {
  severity: "error" | "warning";
  message: string;
};

/** Non-throwing structural checks. Parse/serialize errors are reported
 * separately (via the sync state machine) since they abort before a
 * document exists at all. */
export function validateLevel(doc: LevelDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let playerCount = 0;
  let ghostCount = 0;
  let pelletCount = 0;

  for (let i = 0; i < doc.cells.length; i++) {
    switch (doc.cells[i] as CellKind) {
      case CellKind.Player:
        playerCount += 1;
        break;
      case CellKind.Ghost:
        ghostCount += 1;
        break;
      case CellKind.Pellet:
      case CellKind.PowerPellet:
        pelletCount += 1;
        break;
      case CellKind.Empty:
      case CellKind.Wall:
        break;
    }
  }

  if (playerCount === 0) {
    issues.push({ severity: "error", message: "No player spawn placed." });
  }
  if (ghostCount === 0) {
    issues.push({ severity: "warning", message: "No ghost spawns placed." });
  }
  if (pelletCount === 0) {
    issues.push({ severity: "warning", message: "No pellets or power pellets placed." });
  }

  return issues;
}
