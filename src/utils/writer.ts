import fs from "fs";
import json2csv from "json2csv";
const { parse } = json2csv;
import { Car } from "../config/schema";
import dotenv from "dotenv";

dotenv.config();
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";
const APPEND_TO_GLOBAL = process.env.APPEND_TO_GLOBAL !== 'false'; // true por defecto

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

/**
 * Escribe CSV en una ubicación específica o en OUTPUT_DIR por defecto
 * @param filename - Nombre del archivo
 * @param data - Datos a escribir
 * @param customPath - Path personalizado (opcional)
 */
export function writeCSV(filename: string, data: Car[], customPath?: string) {
  if (data.length === 0) {
    console.log(`⚠️ No hay datos para escribir en ${filename}`);
    return;
  }

  // Usar customPath si existe, sino usar OUTPUT_DIR
  const targetDir = customPath || OUTPUT_DIR;
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const csv = parse(data, { 
    fields: CSV_FIELDS,
    header: true 
  });
  
  const path = `${targetDir}/${filename}`;
  fs.writeFileSync(path, csv);
  console.log(`✅ CSV generado: ${path} (${data.length} registros)`);
}

export function appendToMerged(data: Car[]) {
  if (data.length === 0) return;
  
  // Verificar si está habilitado en .env
  if (!APPEND_TO_GLOBAL) {
    console.log(`⏭️  Saltando global.csv (APPEND_TO_GLOBAL=false)`);
    return;
  }
  
  // Asegurar que existe el directorio OUTPUT_DIR
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
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

// Nueva función: Limpiar global.csv
export function clearGlobalCSV() {
  const path = `${OUTPUT_DIR}/global.csv`;
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
    console.log(`🗑️  global.csv eliminado`);
  }
}