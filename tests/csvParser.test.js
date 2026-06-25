import test from "node:test";
import assert from "node:assert/strict";
import { parseBusinessCsv, parseCsv, rowsToCsv } from "../src/csvParser.js";

test("parseBusinessCsv normalizes valid EC CSV rows", () => {
  const csv = [
    "date,channel,product_name,orders,revenue,ad_spend,impressions,clicks,conversions,refunds",
    "2026-05-01,Email,Refill Pack,2,8000,0,1000,100,5,0"
  ].join("\n");

  const result = parseBusinessCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].revenue, 8000);
  assert.equal(result.rows[0].ad_spend, 0);
});

test("parseBusinessCsv handles missing numeric values without throwing", () => {
  const csv = [
    "date,channel,product_name,orders,revenue,ad_spend,impressions,clicks,conversions,refunds",
    "2026-05-01,Email,Refill Pack,2,,0,1000,100,5,"
  ].join("\n");

  const result = parseBusinessCsv(csv);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].revenue, 0);
  assert.equal(result.rows[0].refunds, 0);
  assert.equal(result.warnings.length, 2);
});

test("parseBusinessCsv reports missing required columns", () => {
  const result = parseBusinessCsv("date,channel\n2026-05-01,Email");

  assert.equal(result.rows.length, 0);
  assert.match(result.errors.join(" "), /必須列が不足/);
});

test("parseCsv reports unclosed quotes and keeps partial data", () => {
  const result = parseCsv("a,b\n\"broken,value");

  assert.equal(result.rows.length, 2);
  assert.match(result.errors.join(" "), /引用符/);
});

test("rowsToCsv escapes commas, quotes, and line breaks", () => {
  const csv = rowsToCsv([{ a: "x,y", b: "quote \" test", c: "line\nbreak" }], ["a", "b", "c"]);

  assert.equal(csv, "a,b,c\n\"x,y\",\"quote \"\" test\",\"line\nbreak\"");
});
