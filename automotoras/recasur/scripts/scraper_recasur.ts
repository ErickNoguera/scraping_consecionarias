// @ts-ignore - Placeholder será reemplazado por el generador
import { createStagehand } from '../../../src/utils/stagehandConfigV2';
// @ts-ignore - Placeholder será reemplazado por el generador
import { CarSchema, type Car } from '../../../src/config/schema';
// @ts-ignore - Path válido solo en scrapers generados
import { writeCSV, appendToMerged } from '../../../src/utils/writer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VehiculoData {
  marca: string;
  modelo: string;
  version: string;
  url_modelo: string;
}

const CONFIG = {
  automotora: 'Recasur',
  csvPath: path.join(__dirname, '../csv'),
  resultsPath: path.join(__dirname, '../results'),
  logsPath: path.join(__dirname, '../logs'),
  delayBetweenPages: 2000,
  maxRetries: 3
};

function sanitizeFolderName(name: string): string {
  let sanitized = name.toLowerCase();
  sanitized = sanitized.replace(/[^\w\s-]/g, '');
  sanitized = sanitized.replace(/[-\s]+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
}

async function leerCSV(): Promise<VehiculoData[]> {
  const csvFiles = fs.readdirSync(CONFIG.csvPath).filter(f => f.endsWith('.csv'));
  
  if (csvFiles.length === 0) {
    throw new Error('No se encontró ningún CSV en la carpeta');
  }

  const csvPath = path.join(CONFIG.csvPath, csvFiles[0]);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  return new Promise((resolve, reject) => {
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }, (err, records: VehiculoData[]) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

function guardarResultadosJSON(data: any[], timestamp: string) {
  const filename = `resultados_${timestamp}.json`;
  const filepath = path.join(CONFIG.resultsPath, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Backup JSON guardado: ${filename}`);
}

function guardarError(error: any, url: string, vehiculo: VehiculoData) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] 
Automotora: ${CONFIG.automotora}
Vehículo: ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.version}
URL: ${url}
Error: ${error}

`;
  const logPath = path.join(CONFIG.logsPath, 'errors.log');
  fs.appendFileSync(logPath, logEntry, 'utf-8');
}

async function scrapear() {
  console.log(`🚀 Iniciando scraper de ${CONFIG.automotora}`);
  console.log('='.repeat(70));

  const stagehand = await createStagehand();
  const vehiculos = await leerCSV();
  const resultados: Car[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  console.log(`📊 Total de vehículos a procesar: ${vehiculos.length}\n`);

  for (let i = 0; i < vehiculos.length; i++) {
    const vehiculo = vehiculos[i];
    console.log(`[${i + 1}/${vehiculos.length}] Procesando: ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.version}`);

    let intentos = 0;
    let exito = false;

    while (intentos < CONFIG.maxRetries && !exito) {
      try {
        await stagehand.page.goto(vehiculo.url_modelo, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });

        const datos = await stagehand.page.extract({
          instruction: `Extrae la información del vehículo ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.version}:
          - Precio de lista (precio normal sin descuentos)
          - Bono de marca (descuento o bono de la marca)
          - Bono de financiamiento (descuento por financiar)
          - Precio con todos los medios de pago
          - Precio con financiamiento
          Si no encuentras algún valor, déjalo como null.`,
          schema: CarSchema
        });

        const resultado: Car = {
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          version: vehiculo.version,
          url: vehiculo.url_modelo,
          dealer: CONFIG.automotora,
          precio_lista: datos.precio_lista,
          bono_marca: datos.bono_marca,
          bono_financiamiento: datos.bono_financiamiento,
          precio_todo_medio_pago: datos.precio_todo_medio_pago,
          precio_con_financiamiento: datos.precio_con_financiamiento
        };

        resultados.push(resultado);

        console.log(`  ✅ Precio lista: ${resultado.precio_lista || 'No encontrado'}`);
        if (resultado.precio_todo_medio_pago) {
          console.log(`     Precio final: ${resultado.precio_todo_medio_pago}`);
        }
        
        exito = true;
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenPages));

      } catch (error) {
        intentos++;
        console.log(`  ⚠️  Error (intento ${intentos}/${CONFIG.maxRetries}): ${error}`);
        
        if (intentos >= CONFIG.maxRetries) {
          console.log(`  ❌ Falló después de ${CONFIG.maxRetries} intentos`);
          guardarError(error, vehiculo.url_modelo, vehiculo);
          
          resultados.push({
            marca: vehiculo.marca,
            modelo: vehiculo.modelo,
            version: vehiculo.version,
            url: vehiculo.url_modelo,
            dealer: CONFIG.automotora,
            precio_lista: null,
            bono_marca: null,
            bono_financiamiento: null,
            precio_todo_medio_pago: null,
            precio_con_financiamiento: null
          });
        } else {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  }

  // Guardar resultados
  const filename = `${sanitizeFolderName(CONFIG.automotora)}_${timestamp}.csv`;
  
  // Guardar CSV en la carpeta results de esta automotora
  writeCSV(filename, resultados, CONFIG.resultsPath);
  
  // Agregar a global.csv (en ./output/)
  appendToMerged(resultados);
  
  // También guardar JSON como backup
  guardarResultadosJSON(resultados, timestamp);

  const exitosos = resultados.filter(r => r.precio_lista !== null).length;
  const folderName = sanitizeFolderName(CONFIG.automotora);
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN');
  console.log('='.repeat(70));
  console.log(`✅ Exitosos:         ${exitosos}`);
  console.log(`❌ Fallidos:         ${resultados.length - exitosos}`);
  console.log(`📁 Total procesados: ${resultados.length}`);
  console.log(`📄 Archivos generados:`);
  console.log(`   - ./automotoras/${folderName}/results/${filename}`);
  console.log(`   - ./automotoras/${folderName}/results/resultados_${timestamp}.json`);
  console.log(`   - ./output/global.csv (consolidado)`);
  console.log('='.repeat(70));

  await stagehand.context.close();
}

scrapear().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});