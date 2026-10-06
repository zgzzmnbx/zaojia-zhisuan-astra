import json

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.mark.parametrize("raw,mode,percent,preview", [
    ({}, "classic", 55, True),
    ({"defaultMode": "D", "agentWidthPercent": "bad"}, "classic", 55, True),
    ({"defaultMode": "agent-primary", "agentWidthPercent": 60, "previewOpen": False}, "agent-primary", 60, False),
    ({"agentWidthPercent": 200, "previewOpen": 0}, "classic", 65, True),
    ({"agentWidthPercent": True}, "classic", 55, True),
    ({"agentWidthPercent": float("inf")}, "classic", 55, True),
])
def test_workspace_layout_defaults_are_safe_and_explicit(tmp_path, monkeypatch, raw, mode, percent, preview):
    path = tmp_path / "defaults.json"
    path.write_text(json.dumps({"workspaceLayout": raw}), encoding="utf-8")
    monkeypatch.setattr(main, "PROJECT_DEFAULT_SETTINGS_PATH", path)
    response = TestClient(main.app).get("/api/project-default-settings")
    assert response.status_code == 200
    assert response.json()["workspaceLayout"] == {
        "defaultMode": mode, "agentWidthPercent": percent, "previewOpen": preview,
    }


def test_invalid_settings_file_falls_back_to_original_layout(tmp_path, monkeypatch):
    path = tmp_path / "defaults.json"
    path.write_text("{invalid", encoding="utf-8")
    monkeypatch.setattr(main, "PROJECT_DEFAULT_SETTINGS_PATH", path)
    assert TestClient(main.app).get("/api/project-default-settings").json()["workspaceLayout"]["defaultMode"] == "classic"
