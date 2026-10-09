"""Use Astra's imported reference assets without changing the frozen engine."""
from dataclasses import replace
from pathlib import Path


def install(paths):
    from app import knowledge_articles
    from app import knowledge_libraries

    # Article metadata and bodies are versioned Astra assets. Keep the 308-file
    # frozen engine (including its original 50 articles) byte-for-byte intact.
    article_root = Path(__file__).resolve().parent / 'reference-assets/cost-articles'
    knowledge_articles.ARTICLE_LIBRARY_ROOT = article_root
    knowledge_articles.MANIFEST_PATH = article_root / 'manifest.json'
    knowledge_articles.reset_article_manifest_cache()
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
