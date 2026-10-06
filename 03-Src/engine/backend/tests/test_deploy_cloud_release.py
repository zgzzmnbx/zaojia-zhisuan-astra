from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = PROJECT_ROOT / "tools/deploy_cloud_release.py"
SPEC = importlib.util.spec_from_file_location("deploy_cloud_release", MODULE_PATH)
assert SPEC and SPEC.loader
deploy_cloud_release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(deploy_cloud_release)


def test_sha256_file_uses_uppercase_digest(tmp_path: Path) -> None:
    sample = tmp_path / "release.tar.gz"
    sample.write_bytes(b"cloud-release")

    assert deploy_cloud_release.sha256_file(sample) == hashlib.sha256(
        b"cloud-release"
    ).hexdigest().upper()


def test_effective_release_version_prefers_release_version() -> None:
    assert (
        deploy_cloud_release.effective_release_version(
            {"version": "v5.19.4", "release_version": "v5.19.7"}
        )
        == "v5.19.7"
    )
    assert deploy_cloud_release.effective_release_version({"version": "v5.19.4"}) == "v5.19.4"


def test_profiles_are_converged_respects_enable_state_and_consistency() -> None:
    assert deploy_cloud_release.profiles_are_converged(
        {
            "profiles": [
                {"enabled": False, "running": False, "profile_consistent": True},
                {"enabled": True, "running": True, "profile_consistent": True},
            ]
        }
    )
    assert not deploy_cloud_release.profiles_are_converged(
        {"profiles": [{"enabled": True, "running": False, "profile_consistent": True}]}
    )
    assert not deploy_cloud_release.profiles_are_converged(
        {"profiles": [{"enabled": True, "running": True, "profile_consistent": False}]}
    )
