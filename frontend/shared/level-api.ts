// Minimal level-service client shared by the editor and the game playground.
// Conflict/retry semantics stay in the editor sync layer; the game only needs
// a read path to load a level id from the URL.

const BASE_URL = "http://127.0.0.1:8000";

export type LevelPayload = {
  id: string;
  version: number;
  ascii2d: string;
};

export async function loadLevelPayload(id: string): Promise<LevelPayload> {
  const response = await fetch(`${BASE_URL}/level/load?${new URLSearchParams({ id })}`);
  if (!response.ok) {
    throw new Error(`Failed to load level ${id}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as LevelPayload;
}
