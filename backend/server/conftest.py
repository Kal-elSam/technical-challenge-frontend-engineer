"""Test isolation: every test gets a fresh in-memory store, never the real
on-disk one, so running the test suite can't write into backend/server/data/
or leak state between tests.
"""

import pytest

from . import app as app_module
from .storage import LevelStore


@pytest.fixture(autouse=True)
def isolated_store() -> None:
    app_module.store = LevelStore()  # no data_path => in-memory only
    app_module.store.seed(app_module.CLASSIC_LEVEL_ID, app_module.CLASSIC)
