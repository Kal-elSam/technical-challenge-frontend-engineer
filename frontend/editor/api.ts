// Thin fetch wrapper around the FastAPI level service. No caching or retry
// logic lives here — that belongs to the sync state machine in sync.ts, which
// knows about dirty/conflict/error states. This module only knows HTTP.

const BASE_URL = "http://127.0.0.1:8000";

export type LevelResponse = {
  id: string;
  version: number;
  ascii2d: string;
};

export type GenerateResponse = {
  seed: number;
  size: number;
  ascii2d: string;
};

export class ConflictError extends Error {
  constructor(
    readonly levelId: string,
    message: string,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(
    readonly levelId: string,
    message: string,
  ) {
    super(message);
    this.name = "NotFoundError";
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function loadLevel(id: string): Promise<LevelResponse> {
  const response = await fetch(`${BASE_URL}/level/load?${new URLSearchParams({ id })}`);
  if (response.status === 404) {
    throw new NotFoundError(id, await parseErrorDetail(response));
  }
  if (!response.ok) {
    throw new Error(`Failed to load level ${id}: ${await parseErrorDetail(response)}`);
  }
  return (await response.json()) as LevelResponse;
}

export async function listLevels(): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/levels`);
  if (!response.ok) {
    throw new Error(`Failed to list levels: ${await parseErrorDetail(response)}`);
  }
  return (await response.json()) as string[];
}

export async function createLevel(ascii2d: string): Promise<LevelResponse> {
  const response = await fetch(`${BASE_URL}/level/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ascii2d }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create level: ${await parseErrorDetail(response)}`);
  }
  return (await response.json()) as LevelResponse;
}

export async function updateLevel(id: string, ascii2d: string, baseVersion: number): Promise<LevelResponse> {
  const response = await fetch(`${BASE_URL}/level/store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ascii2d, base_version: baseVersion }),
  });
  if (response.status === 409) {
    throw new ConflictError(id, await parseErrorDetail(response));
  }
  if (response.status === 404) {
    throw new NotFoundError(id, await parseErrorDetail(response));
  }
  if (!response.ok) {
    throw new Error(`Failed to save level ${id}: ${await parseErrorDetail(response)}`);
  }
  return (await response.json()) as LevelResponse;
}

export async function generateLevel(seed: number, size: number): Promise<GenerateResponse> {
  const response = await fetch(`${BASE_URL}/level/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed, size }),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate level: ${await parseErrorDetail(response)}`);
  }
  return (await response.json()) as GenerateResponse;
}
