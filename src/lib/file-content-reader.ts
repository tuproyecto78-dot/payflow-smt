/**
 * PayFlow SMT — File Content Reader
 *
 * Client-side utility that reads uploaded files and extracts:
 *   - TXT: raw text
 *   - CSV: raw text + parsed rows (headers + row objects)
 *   - XLSX/Excel: parsed rows from the first sheet (via xlsx library)
 *   - PDF: text extraction (simple approach — reads text streams)
 *
 * Returns a KnowledgeSource-compatible object that the /api/knowledge/process
 * endpoint can consume.
 *
 * IMPORTANT: This runs in the browser (client-side) so file content is
 * extracted before sending to the API. The API receives text/rows, never
 * the raw binary file.
 */

export interface ExtractedFileContent {
  source_id: string;
  type: "pdf" | "excel" | "csv" | "txt" | "manual";
  name: string;
  rawText?: string;
  rows?: Record<string, string>[];
  headers?: string[];
}

/**
 * Read a File object and extract its content.
 * Returns an ExtractedFileContent suitable for /api/knowledge/process.
 */
export async function readFileContent(
  file: File,
  sourceId: string
): Promise<ExtractedFileContent> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const name = file.name;

  switch (ext) {
    case "txt":
      return readTxt(file, sourceId, name);
    case "csv":
      return readCsv(file, sourceId, name);
    case "xlsx":
    case "xls":
      return readExcel(file, sourceId, name);
    case "pdf":
      return readPdf(file, sourceId, name);
    default:
      // Try as text
      return readTxt(file, sourceId, name);
  }
}

// ─── TXT reader ──────────────────────────────────────────────────────

async function readTxt(
  file: File,
  sourceId: string,
  name: string
): Promise<ExtractedFileContent> {
  const text = await file.text();
  return {
    source_id: sourceId,
    type: "txt",
    name,
    rawText: text,
  };
}

// ─── CSV reader ──────────────────────────────────────────────────────

async function readCsv(
  file: File,
  sourceId: string,
  name: string
): Promise<ExtractedFileContent> {
  const text = await file.text();
  const { headers, rows } = parseCsv(text);
  return {
    source_id: sourceId,
    type: "csv",
    name,
    rawText: text,
    headers,
    rows,
  };
}

/**
 * Simple CSV parser that handles:
 *   - comma or semicolon delimiters
 *   - quoted fields with commas
 *   - newlines inside quoted fields
 */
function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const delimiter = text.includes(";") && !text.includes(",") ? ";" : ",";
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentLine.push(currentField);
        currentField = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        currentLine.push(currentField);
        currentField = "";
        if (currentLine.some((f) => f.trim())) {
          lines.push(currentLine);
        }
        currentLine = [];
      } else {
        currentField += char;
      }
    }
  }
  // Last field
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField);
    if (currentLine.some((f) => f.trim())) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (lines[i][j] || "").trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ─── Excel reader (via xlsx library) ─────────────────────────────────

async function readExcel(
  file: File,
  sourceId: string,
  name: string
): Promise<ExtractedFileContent> {
  try {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      { header: 1, defval: "" }
    );

    if (jsonData.length === 0) {
      return {
        source_id: sourceId,
        type: "excel",
        name,
        rawText: "",
        headers: [],
        rows: [],
      };
    }

    // First row is headers
    const headers = (jsonData[0] as unknown[]).map((h) => String(h || "").trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const rowArray = jsonData[i] as unknown[];
      if (!rowArray || rowArray.every((v) => !v)) continue;
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = String(rowArray[j] || "").trim();
      }
      rows.push(row);
    }

    // Also build a raw text representation for text-based classification
    const rawText = [headers.join("\t"), ...rows.map((r) => headers.map((h) => r[h]).join("\t"))].join("\n");

    return {
      source_id: sourceId,
      type: "excel",
      name,
      rawText,
      headers,
      rows,
    };
  } catch (err) {
    console.error("[readExcel] error:", err);
    // Fallback: try as text
    const text = await file.text();
    return {
      source_id: sourceId,
      type: "excel",
      name,
      rawText: text,
    };
  }
}

// ─── PDF reader (text extraction) ────────────────────────────────────

async function readPdf(
  file: File,
  sourceId: string,
  name: string
): Promise<ExtractedFileContent> {
  try {
    const buffer = await file.arrayBuffer();
    const text = extractPdfText(buffer);
    return {
      source_id: sourceId,
      type: "pdf",
      name,
      rawText: text,
    };
  } catch (err) {
    console.error("[readPdf] error:", err);
    return {
      source_id: sourceId,
      type: "pdf",
      name,
      rawText: `[Error leyendo PDF: ${err instanceof Error ? err.message : "desconocido"}]`,
    };
  }
}

/**
 * Simple PDF text extraction.
 *
 * PDFs store text in content streams encoded in various ways. This function
 * does a lightweight extraction by finding text between BT/ET (Begin Text /
 * End Text) markers and extracting string literals from Tj and TJ operators.
 *
 * This won't handle all PDFs (especially those with custom encodings or
 * scanned images), but it works for most text-based PDFs.
 */
function extractPdfText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = "";

  // Convert to string (latin1 preserves byte values 0-255)
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  // Find all text between BT and ET markers
  const btEtRegex = /BT\s*(.*?)\s*ET/gs;
  let btMatch;

  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const textBlock = btMatch[1];

    // Extract text from Tj operators: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(textBlock)) !== null) {
      text += decodePdfString(tjMatch[1]) + " ";
    }

    // Extract text from TJ arrays: [(text1) (text2)] TJ
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayRegex.exec(textBlock)) !== null) {
      const arrayContent = tjArrayMatch[1];
      const stringRegex = /\(([^)]*)\)/g;
      let stringMatch;
      while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
        text += decodePdfString(stringMatch[1]);
      }
      text += " ";
    }

    // Add newline after each text block
    if (text.length > 0 && !text.endsWith("\n")) {
      text += "\n";
    }
  }

  // If no text was extracted, try a fallback: look for readable strings
  if (!text.trim()) {
    const fallbackRegex = /\(([A-Za-z0-9\s.,;:!?@#$%^&*()_+\-=\[\]{}|\\/'"`~<>áéíóúñüÁÉÍÓÚÑÜ]{3,})\)/g;
    let fallbackMatch;
    while ((fallbackMatch = fallbackRegex.exec(raw)) !== null) {
      text += fallbackMatch[1] + " ";
    }
  }

  return text.trim();
}

/**
 * Decode a PDF string literal.
 * Handles common escape sequences and basic Latin-1.
 */
function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
