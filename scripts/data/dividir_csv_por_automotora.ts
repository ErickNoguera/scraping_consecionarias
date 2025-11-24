/**
 * Script para dividir CSV de Metabase en archivos por automotora
 * Autor: Erick
 * Fecha: 2024-11-24
 * 
 * Lee un CSV grande con todas las automotoras y genera un CSV
 * individual en la carpeta correspondiente de cada automotora
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

interface VehiculoData {
  automotora_id: string;
  automotora: string;
  marca: string;
  modelo: string;
  version: string;
  url_modelo: string;
}

/**
 * Sanitiza el nombre de la automotora para coincidir con carpeta
 */
function sanitizeFolderName(name: string): string {
  let sanitized = name.toLowerCase();
  sanitized = sanitized.replace(/[^\w\s-]/g, '');
  sanitized = sanitized.replace(/[-\s]+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
}

/**
 * Divide el CSV por automotora
 */
async function dividirCSVPorAutomotora(csvPath: string): Promise<void> {
  console.log('🚀 Iniciando división de CSV por automotora...\n');
  console.log(`📄 Archivo de entrada: ${csvPath}`);
  console.log(`📍 Directorio de trabajo: ${process.cwd()}\n`);
  
  // Verificar que existe el archivo CSV
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ ERROR: No se encontró el archivo ${csvPath}`);
    process.exit(1);
  }

  // Leer el CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }, async (err, records: VehiculoData[]) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(`📊 Total de registros: ${records.length}\n`);

      // Agrupar por automotora
      const automorasMap = new Map<string, VehiculoData[]>();
      
      for (const record of records) {
        const automotora = record.automotora;
        if (!automorasMap.has(automotora)) {
          automorasMap.set(automotora, []);
        }
        automorasMap.get(automotora)!.push(record);
      }

      console.log(`🏢 Total de automotoras encontradas: ${automorasMap.size}\n`);
      console.log('-'.repeat(70));

      // Estadísticas
      let successCount = 0;
      let errorCount = 0;
      let notFoundCount = 0;

      // Crear CSV para cada automotora
      for (const [automotora, vehiculos] of automorasMap.entries()) {
        const folderName = sanitizeFolderName(automotora);
        const automoraPath = path.join('./automotoras', folderName);
        const csvFolderPath = path.join(automoraPath, 'csv');

        try {
          // Verificar que existe la carpeta
          if (!fs.existsSync(automoraPath)) {
            console.log(`⚠️  ${automotora.padEnd(30)} -> Carpeta no existe, saltando...`);
            notFoundCount++;
            continue;
          }

          // Preparar datos para CSV (sin columnas de ID de automotora)
          const csvData = vehiculos.map(v => ({
            marca: v.marca,
            modelo: v.modelo,
            version: v.version,
            url_modelo: v.url_modelo
          }));

          // Generar CSV
          stringify(csvData, {
            header: true,
            columns: ['marca', 'modelo', 'version', 'url_modelo']
          }, (err, output) => {
            if (err) {
              console.log(`❌ ${automotora.padEnd(30)} -> Error al generar CSV`);
              errorCount++;
              return;
            }

            // Guardar archivo
            const timestamp = new Date().toISOString().split('T')[0];
            const csvFileName = `datos_${folderName}_${timestamp}.csv`;
            const csvFilePath = path.join(csvFolderPath, csvFileName);

            fs.writeFileSync(csvFilePath, output, 'utf-8');
            console.log(`✅ ${automotora.padEnd(30)} -> ${vehiculos.length} registros -> ${csvFileName}`);
            successCount++;
          });

        } catch (error) {
          console.log(`❌ ${automotora.padEnd(30)} -> Error: ${error}`);
          errorCount++;
        }
      }

      // Esperar un poco para que terminen todos los stringify
      setTimeout(() => {
        // Resumen final
        console.log('\n' + '='.repeat(70));
        console.log('📊 RESUMEN');
        console.log('='.repeat(70));
        console.log(`✅ CSVs creados:           ${successCount}`);
        console.log(`⚠️  Carpetas no encontradas: ${notFoundCount}`);
        console.log(`❌ Errores:                ${errorCount}`);
        console.log(`🏢 Total automotoras:      ${automorasMap.size}`);
        console.log('='.repeat(70));

        if (notFoundCount > 0) {
          console.log('\n⚠️  Ejecuta primero: npm run setup:folders');
        }

        console.log('\n✨ ¡Proceso completado!\n');
        resolve();
      }, 1000);
    });
  });
}

// Ejecución principal
const csvFile = process.argv[2] || 'datos_metabase_completo.csv';

console.log('=' .repeat(70));
console.log('📦 DIVISOR DE CSV POR AUTOMOTORA');
console.log('='.repeat(70) + '\n');

dividirCSVPorAutomotora(csvFile).catch(error => {
  console.error('❌ Error al procesar:', error);
  process.exit(1);
});