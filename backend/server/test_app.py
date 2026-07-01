"""Tests for the level API's version/conflict contract — the part of the
backend the editor depends on most heavily for "no silent loss of work".
"""

from fastapi.testclient import TestClient

from .app import app

client = TestClient(app)

SAMPLE_ASCII2D = "\n####\n#  #\n####\n"


def test_create_level_returns_id_and_starts_at_version_one() -> None:
    response = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D})
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == 1
    assert body["ascii2d"] == SAMPLE_ASCII2D
    assert body["id"]


def test_load_returns_the_stored_level() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    response = client.get("/level/load", params={"id": created["id"]})
    assert response.status_code == 200
    assert response.json() == created


def test_load_missing_level_is_404() -> None:
    response = client.get("/level/load", params={"id": "does-not-exist"})
    assert response.status_code == 404


def test_update_with_current_version_succeeds_and_bumps_version() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    updated_ascii2d = "\n####\n#. #\n####\n"

    response = client.post(
        "/level/store",
        json={"id": created["id"], "base_version": created["version"], "ascii2d": updated_ascii2d},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["version"] == created["version"] + 1
    assert body["ascii2d"] == updated_ascii2d


def test_update_with_stale_version_is_409_and_does_not_apply() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    # A first save moves the level to version 2 out from under us.
    client.post(
        "/level/store",
        json={"id": created["id"], "base_version": created["version"], "ascii2d": "\n####\n#O #\n####\n"},
    )

    stale_response = client.post(
        "/level/store",
        json={"id": created["id"], "base_version": created["version"], "ascii2d": "\n####\n#PU#\n####\n"},
    )

    assert stale_response.status_code == 409
    # The rejected write must not have been applied: reloading still shows
    # the version-2 content, not the stale client's payload.
    current = client.get("/level/load", params={"id": created["id"]}).json()
    assert current["version"] == 2
    assert current["ascii2d"] == "\n####\n#O #\n####\n"


def test_update_missing_level_is_404() -> None:
    response = client.post(
        "/level/store",
        json={"id": "does-not-exist", "base_version": 1, "ascii2d": SAMPLE_ASCII2D},
    )
    assert response.status_code == 404


def test_update_without_base_version_is_rejected() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    response = client.post("/level/store", json={"id": created["id"], "ascii2d": SAMPLE_ASCII2D})
    assert response.status_code == 422


def test_generate_is_deterministic_for_the_same_seed_and_size() -> None:
    first = client.post("/level/generate", json={"seed": 7, "size": 21}).json()
    second = client.post("/level/generate", json={"seed": 7, "size": 21}).json()
    assert first["ascii2d"] == second["ascii2d"]


def test_generate_does_not_persist_a_level() -> None:
    before = set(client.get("/levels").json())
    client.post("/level/generate", json={"seed": 3, "size": 21})
    after = set(client.get("/levels").json())
    # Generation only returns text; the editor must store it explicitly to
    # get an id/version before editing.
    assert before == after


def test_classic_level_is_seeded_and_listed() -> None:
    response = client.get("/levels")
    assert "classic" in response.json()


def test_delete_custom_level_removes_it_from_storage() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    response = client.post("/level/delete", json={"id": created["id"]})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert client.get("/level/load", params={"id": created["id"]}).status_code == 404
    assert created["id"] not in client.get("/levels").json()


def test_delete_custom_level_via_query_delete() -> None:
    created = client.post("/level/store", json={"ascii2d": SAMPLE_ASCII2D}).json()
    response = client.delete("/level/delete", params={"id": created["id"]})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_delete_missing_level_is_404() -> None:
    response = client.post("/level/delete", json={"id": "does-not-exist"})
    assert response.status_code == 404


def test_delete_classic_level_is_forbidden() -> None:
    response = client.post("/level/delete", json={"id": "classic"})
    assert response.status_code == 403
    assert client.get("/level/load", params={"id": "classic"}).status_code == 200
