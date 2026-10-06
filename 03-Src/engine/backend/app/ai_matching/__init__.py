"""AI-enhanced matching primitives.

This package is deliberately isolated from the deterministic pricing engine.  It
may prepare and verify proposals, but it never owns the trusted numeric assets.
"""

from .contracts import (
    AI_MATCHING_SCHEMA_VERSION,
    AI_MATCHING_STAGES,
    MATCHING_MODES,
    normalize_matching_mode,
)
from .orchestrator import analyze_run, cancel_run, confirm_proposals, prepare_run
from .store import load_ai_state

__all__ = [
    "AI_MATCHING_SCHEMA_VERSION",
    "AI_MATCHING_STAGES",
    "MATCHING_MODES",
    "analyze_run",
    "cancel_run",
    "confirm_proposals",
    "load_ai_state",
    "normalize_matching_mode",
    "prepare_run",
]
