import fs from "fs";
import json2csv from "json2csv";
const { parse } = json2csv;
import { Car } from "../config/schema";
import dotenv from "dotenv";

dotenv.config();
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";

// Orden específico de campos para el CSV
const CSV_FIELDS = [
  'marca',
  'modelo', 
  'version',
  'precio_lista',
  'bono_marca',
  'bono_financiamiento',
  'precio_todo_medio_pago',
  'precio_con_financiamiento',
  'url',
  'dealer'
];

export function writeCSV(filename: string, data: Car[]) {
  if (data.length === 0) {
    console.log(`⚠️ No hay datos para escribir en ${filename}`);
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const csv = parse(data, { 
    fields: CSV_FIELDS,
    header: true 
  });
  
  const path = `${OUTPUT_DIR}/${filename}`;
  fs.writeFileSync(path, csv);
  console.log(`✅ CSV generado: ${path} (${data.length} registros)`);
}

export function appendToMerged(data: Car[]) {
  if (data.length === 0) return;
  
  const path = `${OUTPUT_DIR}/global.csv`;
  const fileExists = fs.existsSync(path);
  
  // Si el archivo no existe, crear con header
  const csv = parse(data, { 
    fields: CSV_FIELDS,
    header: !fileExists 
  });
  
  if (!fileExists) {
    fs.writeFileSync(path, csv + "\n");
  } else {
    fs.appendFileSync(path, csv + "\n");
  }
  
  console.log(`✅ Agregados ${data.length} registros a global.csv`);
}