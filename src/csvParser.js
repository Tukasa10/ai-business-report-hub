export const REQUIRED_COLUMNS = [
  "date",
  "channel",
  "product_name",
  "orders",
  "revenue",
  "ad_spend",
  "impressions",
  "clicks",
  "conversions",
  "refunds"
];

export const NUMERIC_COLUMNS = [
  "orders",
  "revenue",
  "ad_spend",
  "impressions",
  "clicks",
  "conversions",
  "refunds"
];

const TEXT_COLUMNS = ["date", "channel", "product_name"];

export function parseCsv(text) {
  const errors = [];
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  if (typeof text !== "string") {
    return { rows: [], errors: ["CSVテキストが文字列ではありません。"] };
  }

  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    errors.push("CSVの引用符が閉じられていません。該当行以降は可能な範囲で読み込みました。");
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return {
    rows: rows.filter((cells) => cells.some((cell) => String(cell).trim() !== "")),
    errors
  };
}

export function parseBusinessCsv(text) {
  const parsed = parseCsv(text);
  const errors = [...parsed.errors];
  const warnings = [];

  if (parsed.rows.length === 0) {
    return {
      rows: [],
      errors: [...errors, "CSVにデータがありません。"],
      warnings,
      meta: { totalRows: 0, acceptedRows: 0, rejectedRows: 0 }
    };
  }

  const headers = parsed.rows[0].map((header) => normalizeHeader(header));
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [...errors, `必須列が不足しています: ${missingColumns.join(", ")}`],
      warnings,
      meta: { totalRows: parsed.rows.length - 1, acceptedRows: 0, rejectedRows: parsed.rows.length - 1 }
    };
  }

  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const normalizedRows = [];
  let rejectedRows = 0;

  parsed.rows.slice(1).forEach((cells, rowOffset) => {
    const lineNumber = rowOffset + 2;
    const record = {};

    TEXT_COLUMNS.forEach((column) => {
      const value = readCell(cells, headerIndex.get(column)).trim();
      record[column] = value;
      if (!value) {
        warnings.push(`${lineNumber}行目: ${column} が空です。`);
      }
    });

    NUMERIC_COLUMNS.forEach((column) => {
      const rawValue = readCell(cells, headerIndex.get(column)).trim();
      const number = parseNumber(rawValue);
      if (rawValue === "") {
        warnings.push(`${lineNumber}行目: ${column} が空のため 0 として扱いました。`);
        record[column] = 0;
        return;
      }
      if (!Number.isFinite(number)) {
        warnings.push(`${lineNumber}行目: ${column} が数値ではないため 0 として扱いました。`);
        record[column] = 0;
        return;
      }
      record[column] = number;
    });

    if (!isValidDateKey(record.date)) {
      warnings.push(`${lineNumber}行目: date の形式を確認してください (${record.date || "空欄"})。`);
    }

    if (!record.date || !record.channel || !record.product_name) {
      rejectedRows += 1;
      warnings.push(`${lineNumber}行目: 主要テキスト列が不足しているため集計対象外にしました。`);
      return;
    }

    normalizedRows.push(record);
  });

  return {
    rows: normalizedRows,
    errors,
    warnings,
    meta: {
      totalRows: parsed.rows.length - 1,
      acceptedRows: normalizedRows.length,
      rejectedRows
    }
  };
}

export function rowsToCsv(rows, columns) {
  const safeColumns = columns && columns.length > 0 ? columns : inferColumns(rows);
  const header = safeColumns.map(escapeCsvCell).join(",");
  const body = rows.map((row) => safeColumns.map((column) => escapeCsvCell(row[column])).join(","));
  return [header, ...body].join("\n");
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function readCell(cells, index) {
  if (typeof index !== "number" || index < 0 || index >= cells.length) {
    return "";
  }
  return String(cells[index] ?? "");
}

function parseNumber(value) {
  if (typeof value !== "string") {
    return Number(value);
  }
  return Number(value.replace(/,/g, ""));
}

function isValidDateKey(value) {
  if (!value) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function inferColumns(rows) {
  const columnSet = new Set();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => columnSet.add(key));
  });
  return Array.from(columnSet);
}
