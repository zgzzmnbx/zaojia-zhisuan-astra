from __future__ import annotations

from pathlib import Path


def recalculate_workbook(path: str | Path) -> bool:
    """Recalculate Excel formulas on Windows when Microsoft Excel is available."""
    workbook_path = Path(path).resolve()
    if not workbook_path.exists():
        return False
    try:
        import win32com.client  # type: ignore[import-not-found]
    except Exception:
        return False

    excel = None
    workbook = None
    try:
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        workbook = excel.Workbooks.Open(str(workbook_path))
        excel.CalculateFullRebuild()
        workbook.Save()
        return True
    except Exception:
        return False
    finally:
        if workbook is not None:
            try:
                workbook.Close(SaveChanges=True)
            except Exception:
                pass
        if excel is not None:
            try:
                excel.Quit()
            except Exception:
                pass
