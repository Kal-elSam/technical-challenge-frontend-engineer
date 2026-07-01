"""Level storage, optionally backed by a JSON file on disk.

A level is opaque ascii2d text plus a monotonic ``version``. The version is the
backend's authority signal: every accepted write bumps it, and updates must
quote the ``base_version`` they were derived from. A stale ``base_version`` is
rejected with ``VersionConflict``, so a reconnecting or duplicated client cannot
silently clobber newer work or double-apply an edit.

Persistence is intentionally minimal: a single JSON file holding every level,
rewritten atomically after each mutation. That is enough to survive a process
restart without introducing a database, and it keeps the id/version/ascii2d
contract identical whether or not a data path is configured.
"""

import json
import logging
import threading
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StoredLevel:
    id: str
    version: int
    ascii2d: str


class LevelNotFound(Exception):
    def __init__(self, level_id: str) -> None:
        super().__init__(f"No level with id {level_id!r}")
        self.level_id = level_id


class VersionConflict(Exception):
    """Raised when an update's base_version is not the current version."""

    def __init__(self, level_id: str, expected: int, actual: int) -> None:
        super().__init__(
            f"Stale write to {level_id!r}: based on version {expected}, "
            f"current is {actual}"
        )
        self.level_id = level_id
        self.expected = expected
        self.actual = actual


class LevelStore:
    """In-memory index of levels, mirrored to ``data_path`` if given.

    ``data_path=None`` keeps the original in-memory-only behavior (used by
    tests, which should never touch a file on disk).
    """

    def __init__(self, data_path: Path | None = None) -> None:
        self._levels: dict[str, StoredLevel] = {}
        self._lock = threading.Lock()
        self._data_path = data_path
        if self._data_path is not None:
            self._load()

    def create(self, ascii2d: str) -> StoredLevel:
        level = StoredLevel(id=uuid.uuid4().hex, version=1, ascii2d=ascii2d)
        with self._lock:
            self._levels[level.id] = level
            self._save()
        return level

    def seed(self, level_id: str, ascii2d: str) -> StoredLevel:
        """Insert a level under a fixed id (used to preload CLASSIC)."""
        level = StoredLevel(id=level_id, version=1, ascii2d=ascii2d)
        with self._lock:
            self._levels[level_id] = level
            self._save()
        return level

    def get(self, level_id: str) -> StoredLevel:
        with self._lock:
            level = self._levels.get(level_id)
        if level is None:
            raise LevelNotFound(level_id)
        return level

    def update(self, level_id: str, ascii2d: str, base_version: int) -> StoredLevel:
        with self._lock:
            current = self._levels.get(level_id)
            if current is None:
                raise LevelNotFound(level_id)
            if current.version != base_version:
                raise VersionConflict(level_id, base_version, current.version)
            updated = StoredLevel(
                id=level_id, version=current.version + 1, ascii2d=ascii2d
            )
            self._levels[level_id] = updated
            self._save()
        return updated

    def ids(self) -> list[str]:
        with self._lock:
            return list(self._levels.keys())

    def _load(self) -> None:
        """Best-effort restore from disk; a missing/corrupt file just starts
        empty rather than blocking server startup."""
        assert self._data_path is not None
        if not self._data_path.exists():
            return
        try:
            raw = json.loads(self._data_path.read_text())
            self._levels = {
                level_id: StoredLevel(**fields) for level_id, fields in raw.items()
            }
        except (OSError, ValueError, TypeError) as exc:
            logger.warning("Could not load levels from %s: %s", self._data_path, exc)

    def _save(self) -> None:
        """Must be called with ``self._lock`` held. Writes to a temp file and
        renames over the target so a crash mid-write can't corrupt it."""
        if self._data_path is None:
            return
        try:
            self._data_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self._data_path.with_suffix(".tmp")
            payload = {
                level_id: asdict(level) for level_id, level in self._levels.items()
            }
            tmp_path.write_text(json.dumps(payload, indent=2))
            tmp_path.replace(self._data_path)
        except OSError as exc:
            # Durability is a P1 nicety; a save failure here should not take
            # down an otherwise-successful in-memory write.
            logger.warning("Could not persist levels to %s: %s", self._data_path, exc)
