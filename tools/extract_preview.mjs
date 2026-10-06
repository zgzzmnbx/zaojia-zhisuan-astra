// One-time, read-only extraction from the user's original project.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Pass the original project directory');
const destination = path.resolve(import.meta.dirname, '../03-Src/studio/table');
fs.mkdirSync(destination, {recursive: true});
if (fs.existsSync(path.join(destination, 'legacy-preview.ts'))) throw new Error('Existing extraction is never overwritten');
const sourcePath = path.join(sourceRoot, 'frontend/src/App.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  'PreviewColumn', 'PreviewColumnPreferences', 'PreviewRowItem',
  'DEFAULT_PREVIEW_CELL_MAX_DISPLAY_CHARS', 'MIN_PREVIEW_COLUMN_WIDTH_PX', 'MAX_PREVIEW_COLUMN_WIDTH_PX', 'DEFAULT_CORE_PREVIEW_LABELS',
  'clampPreviewColumnWidth', 'previewColumnWidthKeys', 'normalizePreviewColumnPreferences',
  'previewCellText', 'warningCellValues', 'warningCellState', 'previewDisplayText', 'previewHeaderText', 'compactPreviewHeader',
  'previewSheetLabel', 'isMatchedNumberCell', 'previewCellClass', 'previewCellTitle', 'isEditablePreviewColumn',
  'normalizePreviewSheetName', 'previewExcelRowNumber', 'filterPreviewRows', 'warningFilterColumnIndex',
  'hasWarningFilterValue', 'isTotalSummaryRow', 'buildAvailablePreviewColumns', 'buildPreviewColumns',
  'previewSheetKey', 'previewSheetsFromTablePreview', 'isCorePreviewSheet', 'resolvePreviewPreferenceLabels',
  'previewColumnMatchesPreference', 'findPriceIndex', 'compactHeader', 'isWarningHeader',
]);
const chunks = [], entries = [];
function walk(node) {
  const name = node.name?.getText(ast);
  if (name && names.has(name) && (ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isVariableDeclaration(node))) {
    let body = node.getText(ast).replaceAll('string | number | null', 'string | number | boolean | null').replaceAll('SheetMappingConfig[]', 'unknown[]');
    chunks.push(`export ${ts.isVariableDeclaration(node) ? 'const ' : ''}${body}${ts.isVariableDeclaration(node) ? ';' : ''}`);
    entries.push({name, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1});
    names.delete(name);
  }
  ts.forEachChild(node, walk);
}
walk(ast);
if (names.size) throw new Error(`Missing: ${[...names]}`);
const preamble = `/** Extracted from 智算2.0 frontend/src/App.tsx. See legacy-source.json.
 * Function bodies retain original behavior; types widened for boolean cells.
 * Presentation only. The original project is read-only.
 */
import type {Preview as TablePreview} from '../types';
type WarningFilterField = '数量';
type OutputRowFilterSettings = {enabled:boolean;value_filter_field:WarningFilterField};
const WARNING_FILTER_FIELD_ALIASES = {数量:['数量','工程量','工程数量','工程量合计']};
`;
fs.writeFileSync(path.join(destination, 'legacy-preview.ts'), preamble + chunks.join('\n\n') + '\n');
const settingsPath = path.join(sourceRoot, 'config/project-default-settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '')).previewColumns;
const defaults = Object.fromEntries(['defaultLabels','sheetOverrides','headerRows','maxDisplayChars','columnWidths'].map(key => [key, settings[key]]));
fs.writeFileSync(path.join(destination, 'legacy-defaults.json'), JSON.stringify(defaults, (key,value)=>key.startsWith('_') ? undefined : value, 2)+'\n');
fs.writeFileSync(path.join(destination, 'legacy-source.json'), JSON.stringify({source:'造价智算 V2.0',date:'2026-10-05',files:[sourcePath,settingsPath].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),entries},null,2)+'\n');
console.log(`Extracted ${entries.length} declarations; original project unchanged.`);
