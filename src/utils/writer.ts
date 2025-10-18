import fs from "fs";
import json2csv from "json2csv";
const { parse } = json2csv;
import { Car } from "../config/schema";
import dotenv from "dotenv";

dotenv.config();
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

export function writeCSV(filename: string, data: Car[]) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const csv = parse(data, { fields: Object.keys(data[0] || {}) });
  const path = `${OUTPUT_DIR}/${filename}`;
  fs.writeFileSync(path, csv);
  console.log(`✅ CSV generado: ${path}`);
}

export function appendToMerged(data: Car[]) {
  const path = `${OUTPUT_DIR}/global.csv`;
  const csv = parse(data, { header: !fs.existsSync(path), fields: Object.keys(data[0] || {}) });
  fs.appendFileSync(path, csv + "\n");
}