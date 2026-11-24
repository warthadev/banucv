export interface ParsedAgentFile {
  name: string;
  content: string;
  type: string;
}

const parsePdf = async (file: File): Promise<string> => {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/build/pdf.mjs"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    pages.push(text.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  const content = pages.join("\n\n").trim();
  if (!content) throw new Error("No text could be extracted from this PDF. Scanned pages need OCR first.");
  return content;
};

const parseDocx = async (file: File): Promise<string> => {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const content = result.value.trim();
  if (!content) throw new Error("No text could be extracted from this DOCX file.");
  return content;
};

const parseSpreadsheet = async (file: File): Promise<string> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheets = workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return `Sheet: ${name}\n${csv}`;
  });
  const content = sheets.filter((sheet) => sheet.trim()).join("\n\n").trim();
  if (!content) throw new Error("No text could be extracted from this spreadsheet.");
  return content;
};

const parseNotebook = (text: string): string => {
  const notebook = JSON.parse(text) as { cells?: { cell_type?: string; source?: string | string[] }[] };
  if (!Array.isArray(notebook.cells)) throw new Error("This notebook file has no readable cells.");
  const content = notebook.cells.map((cell, index) => {
    const source = Array.isArray(cell.source) ? cell.source.join("") : cell.source || "";
    return `Cell ${index + 1}${cell.cell_type ? ` (${cell.cell_type})` : ""}\n${source}`;
  }).join("\n\n").trim();
  if (!content) throw new Error("No text could be extracted from this notebook.");
  return content;
};

const parseText = (text: string, extension: string): string => {
  const sample = text.slice(0, 8192);
  const replacementCharacters = [...sample].filter((character) => character === "\uFFFD").length;
  if (sample.includes("\u0000") || (sample.length > 0 && replacementCharacters / sample.length > 0.02)) {
    if (extension === "doc") throw new Error("Legacy DOC files are binary. Export this file as DOCX or PDF first.");
    if (extension === "ppt" || extension === "pptx") throw new Error("PowerPoint files are not supported yet. Export slides as PDF first.");
    throw new Error("This file appears to be binary and cannot be read as plain text.");
  }
  return text;
};

export const parseAgentFile = async (file: File, name = file.name): Promise<ParsedAgentFile> => {
  const extension = name.split(".").at(-1)?.toLowerCase() || "";
  let content: string;
  if (extension === "pdf") content = await parsePdf(file);
  else if (extension === "docx") content = await parseDocx(file);
  else if (["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(extension)) content = await parseSpreadsheet(file);
  else if (extension === "ipynb") content = parseNotebook(await file.text());
  else content = parseText(await file.text(), extension);
  return { name, content, type: file.type };
};

export const KAGGLE_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

const KAGGLE_STAGE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx",
  "xls", "xlsx", "xlsm", "xlsb", "ods", "csv", "tsv", "parquet", "sqlite", "db",
  "zip", "tar", "gz", "tgz", "7z", "rar",
  "mp3", "wav", "m4a", "ogg", "flac", "aac",
  "mp4", "mkv", "webm", "mov", "avi",
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff",
]);

export const fileExtensionOf = (name: string): string => name.split(/[/\\]/).pop()?.split(".").pop()?.toLowerCase() || "";

/** File yang lebih baik diproses di sandbox Kaggle daripada diekstrak di browser. */
export const shouldStageFileOnKaggle = (file: File, name = file.name): boolean => {
  const extension = fileExtensionOf(name);
  if (KAGGLE_STAGE_EXTENSIONS.has(extension)) return true;
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  if (file.size > 80_000 && !file.type.startsWith("text/") && !["json", "md", "txt", "ts", "tsx", "js", "py"].includes(extension)) return true;
  return false;
};
