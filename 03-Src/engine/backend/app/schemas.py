from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


FIELD_COLUMNS = ["要素1", "要素2", "要素3", "要素4", "要素5", "单位"]


@dataclass(frozen=True)
class MatchResult:
    status: str
    price: int | float | str | None
    message: str
    candidates: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ReviewRow:
    excel_row: int
    status: str
    message: str
    values: dict[str, Any]


@dataclass
class FillSummary:
    total_data_rows: int
    price_column: str
    filled_rows: int
    matched_rows: int
    unchanged_rows: int
    review_rows: int
    conflict_rows: int
    output_excel: str
    output_report: str
    report_text: str
    table_preview: dict[str, Any]
    review_details: list[ReviewRow] = field(default_factory=list)
    price_logs: list[str] = field(default_factory=list)
    physical_matched_rows: int = 0
    physical_experience_rows: int = 0
    physical_review_rows: int = 0
    technical_matched_rows: int = 0
    technical_experience_rows: int = 0
    technical_review_rows: int = 0
    warning_summary: dict[str, Any] = field(default_factory=dict)
    warning_details: list[dict[str, Any]] = field(default_factory=list)
    matching_status: str = "completed"

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_data_rows": self.total_data_rows,
            "price_column": self.price_column,
            "filled_rows": self.filled_rows,
            "matched_rows": self.matched_rows,
            "unchanged_rows": self.unchanged_rows,
            "review_rows": self.review_rows,
            "conflict_rows": self.conflict_rows,
            "output_excel": self.output_excel,
            "output_report": self.output_report,
            "report_text": self.report_text,
            "table_preview": self.table_preview,
            "review_details": [
                {
                    "excel_row": row.excel_row,
                    "status": row.status,
                    "message": row.message,
                    "values": row.values,
                }
                for row in self.review_details
            ],
            "price_logs": self.price_logs,
            "physical_matched_rows": self.physical_matched_rows,
            "physical_experience_rows": self.physical_experience_rows,
            "physical_review_rows": self.physical_review_rows,
            "technical_matched_rows": self.technical_matched_rows,
            "technical_experience_rows": self.technical_experience_rows,
            "technical_review_rows": self.technical_review_rows,
            "warning_summary": self.warning_summary,
            "warning_details": self.warning_details,
            "matching_status": self.matching_status,
        }
