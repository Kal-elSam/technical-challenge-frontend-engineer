// Cross-app links between the level editor and the game playground.

export const DEFAULT_GAME_ORIGIN = "http://localhost:3000";

export function playUrlForLevel(levelId: string, origin: string = DEFAULT_GAME_ORIGIN): string {
  const url = new URL(origin);
  url.searchParams.set("level", levelId);
  return url.toString();
}
