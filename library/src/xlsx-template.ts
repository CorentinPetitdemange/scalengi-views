import { strToU8, zipSync } from "fflate";
import type { TemplateColumn, TemplateSheet, WorkbookTemplateSpec } from "./configuration";

const xml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const colName = (index: number) => { let name = ""; let current = index + 1; while (current) { current -= 1; name = String.fromCharCode(65 + current % 26) + name; current = Math.floor(current / 26); } return name; };
const safeSheetName = (name: string, fallback: string) => (name || fallback).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || fallback;
const safeFilename = (name: string) => `${name.replace(/\.xlsx$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/(^[-.]|[-.]$)/g, "").slice(0, 100) || "modele-scalengi"}.xlsx`;

function cellXml(value: string | number | boolean | null, ref: string, style: number) {
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function validationXml(column: TemplateColumn, index: number) {
  if (!column.values?.length) return "";
  const list = column.values.join(",").replaceAll('"', '""');
  if (list.length > 240) return "";
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Valeur non autorisée" error="Choisissez une valeur proposée par la structure de la vue." sqref="${colName(index)}2:${colName(index)}500"><formula1>&quot;${xml(list)}&quot;</formula1></dataValidation>`;
}

function sheetXml(sheet: TemplateSheet) {
  const rows = [sheet.columns.map((column) => column.label), ...(sheet.rows ?? [])];
  const widthXml = sheet.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 20}" customWidth="1"/>`).join("");
  const rowsXml = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}" ht="${rowIndex === 0 ? 26 : 21}" customHeight="1">${sheet.columns.map((_, columnIndex) => cellXml(row[columnIndex] ?? null, `${colName(columnIndex)}${rowIndex + 1}`, rowIndex === 0 ? 1 : rowIndex % 2 === 0 ? 2 : 0)).join("")}</row>`).join("");
  const validations = sheet.columns.map(validationXml).filter(Boolean);
  const lastColumn = colName(Math.max(0, sheet.columns.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr><dimension ref="A1:${lastColumn}${Math.max(1, rows.length)}"/><sheetViews><sheetView tabSelected="0" workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widthXml}</cols><sheetData>${rowsXml}</sheetData><autoFilter ref="A1:${lastColumn}${Math.max(1, rows.length)}"/>${validations.length ? `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>` : ""}<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.2" footer="0.2"/></worksheet>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Aptos"/><family val="2"/><color rgb="FF172033"/></font><font><b/><sz val="10"/><name val="Aptos Display"/><family val="2"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172554"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function createWorkbookBytes(specification: WorkbookTemplateSpec) {
  if (!specification.sheets.length) throw new Error("Le modèle Excel doit contenir au moins une feuille.");
  if (specification.sheets.length > 32) throw new Error("Le modèle Excel ne peut pas contenir plus de 32 feuilles.");
  for (const sheet of specification.sheets) {
    if (!sheet.columns.length || sheet.columns.length > 100) throw new Error(`La feuille « ${sheet.name} » doit contenir entre 1 et 100 colonnes.`);
    if ((sheet.rows?.length ?? 0) > 25_000) throw new Error(`La feuille « ${sheet.name} » dépasse 25 000 lignes.`);
  }
  const usedNames = new Set<string>();
  const sheets = specification.sheets.map((sheet, index) => { let name = safeSheetName(sheet.name, `Feuille ${index + 1}`); let suffix = 2; while (usedNames.has(name)) name = `${safeSheetName(sheet.name, "Feuille").slice(0, 27)} ${suffix++}`; usedNames.add(name); return { ...sheet, name }; });
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const sheetContentTypes = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheetContentTypes}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="0"/></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(specification.viewTitle)}</dc:title><dc:creator>Scalengi Views</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Scalengi Views</Application><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${xml(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts></Properties>`),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function downloadWorkbookTemplate(specification: WorkbookTemplateSpec) {
  const bytes = createWorkbookBytes(specification);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(specification.filename);
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
