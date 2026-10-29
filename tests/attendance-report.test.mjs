import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../attendance.js", import.meta.url), "utf8");

test("CSV cell escaping preserves Vietnamese, commas, quotes and line breaks", () => {
  const match = source.match(/const csvCell = value => \{[^\n]+\};/);
  assert.ok(match, "production csvCell helper must exist");
  const csvCell = Function("return (" + match[0].replace(/^const csvCell = /, "").replace(/;$/, "") + ")")();
  assert.equal(csvCell('Nguyễn Văn A, "Đội 1"'), '"Nguyễn Văn A, ""Đội 1"""');
  assert.equal(csvCell("Hải Phòng"), '"Hải Phòng"');
  assert.equal(csvCell(null), '""');
});

test("CSV export protects spreadsheet formulas", () => {
  const match = source.match(/const csvCell = value => \{[^\n]+\};/);
  const csvCell = Function("return (" + match[0].replace(/^const csvCell = /, "").replace(/;$/, "") + ")")();
  for (const value of ["=1+1", "+SUM(A1:A2)", "-2+3", "@SUM(A1)", "  =1+1"]) {
    assert.equal(csvCell(value).startsWith('"\''), true, value);
  }
  assert.equal(csvCell("Trung").startsWith('"\''), false);
});

test("both CSV exports use a real UTF-8 BOM and CRLF separators", () => {
  assert.match(source, /const csv = "\\ufeff" \+ rows\.map\(row => row\.map\(value =>/);
  assert.match(source, /\.join\("\\r\\n"\);/);
  assert.match(source, /const csv = "\\ufeff" \+ rows\.map\(row => row\.map\(csvCell\)/);
  assert.match(source, /\.join\("\\r\\n"\);/);
});

test("report retains pagination and conservative workday rules", () => {
  assert.match(source, /constraints\.push\(limit\(500\)\)/);
  assert.match(source, /constraints\.push\(limit\(1000\)\)/);
  assert.match(source, /record\?\.adminAdjusted && record\?\.adjustedBy && userById\.get\(record\.adjustedBy\)\?\.role === "admin"/);
  assert.match(source, /start && end/);
  assert.match(source, /Chờ xác nhận/);
});
