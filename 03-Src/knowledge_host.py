"""Use Astra's imported reference assets without changing the frozen engine."""
from dataclasses import replace


def install(paths):
    from app import knowledge_libraries
    original = knowledge_libraries._configured_sources

    def sources(library, project_root):
        if library.id != 'cost-aiw' or project_root.resolve() != paths.PROJECT_ROOT.resolve():
            return original(library, project_root)
        imported = paths.RUNTIME_DIR / 'astra-working-assets/knowledge/造价AIW资料库'
        # An explicit local import wins; never silently read the original project.
        if not (imported / 'manifest.json').is_file():
            return original(library, project_root)
        relative = imported.resolve().relative_to(project_root.resolve()).as_posix()
        return original(replace(library, paths=(relative,)), project_root)

    knowledge_libraries._configured_sources = sources
