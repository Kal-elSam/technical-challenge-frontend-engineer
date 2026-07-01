"""Tests for the JSON-file persistence layer itself (P1): a fresh LevelStore
pointed at the same path must recover what a previous process wrote, and the
version/conflict contract must be unaffected by whether persistence is on.
"""

from pathlib import Path

import pytest

from .storage import LevelNotFound, LevelStore, VersionConflict


def test_in_memory_store_never_touches_disk(tmp_path: Path) -> None:
    untouched = tmp_path / "should-not-exist.json"
    store = LevelStore()  # no data_path
    store.create("\n##\n")
    assert not untouched.exists()


def test_a_new_store_recovers_levels_written_by_a_previous_one(tmp_path: Path) -> None:
    data_path = tmp_path / "levels.json"

    first_process = LevelStore(data_path=data_path)
    created = first_process.create("\n####\n#  #\n####\n")
    first_process.update(created.id, "\n####\n#. #\n####\n", base_version=1)

    # Simulate a restart: a brand-new LevelStore instance, same file.
    second_process = LevelStore(data_path=data_path)
    recovered = second_process.get(created.id)

    assert recovered.id == created.id
    assert recovered.version == 2
    assert recovered.ascii2d == "\n####\n#. #\n####\n"


def test_missing_data_file_starts_empty_instead_of_failing(tmp_path: Path) -> None:
    store = LevelStore(data_path=tmp_path / "does-not-exist-yet.json")
    assert store.ids() == []


def test_corrupt_data_file_starts_empty_instead_of_crashing_startup(tmp_path: Path) -> None:
    data_path = tmp_path / "levels.json"
    data_path.write_text("{not valid json")
    store = LevelStore(data_path=data_path)
    assert store.ids() == []


def test_version_conflict_contract_holds_with_persistence_enabled(tmp_path: Path) -> None:
    store = LevelStore(data_path=tmp_path / "levels.json")
    created = store.create("\n##\n")

    store.update(created.id, "\n##\n", base_version=1)

    with pytest.raises(VersionConflict):
        store.update(created.id, "\n##\n", base_version=1)  # stale now

    with pytest.raises(LevelNotFound):
        store.get("nonexistent")


def test_delete_removes_level_and_persists(tmp_path: Path) -> None:
    data_path = tmp_path / "levels.json"
    store = LevelStore(data_path=data_path)
    created = store.create("\n##\n")
    store.delete(created.id)

    with pytest.raises(LevelNotFound):
        store.get(created.id)

    restarted = LevelStore(data_path=data_path)
    assert created.id not in restarted.ids()
