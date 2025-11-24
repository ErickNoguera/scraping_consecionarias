import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Automotora {
  id: string;
  automotora: string;
  cantidad_sucursales: string;
}

function sanitizeFolderName(name: string): string {
  let sanitized = name.toLowerCase();
  sanitized = sanitized.replace(/[^\w\s-]/g, '');
  sanitized = sanitized.replace(/[-\s]+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
}

async function leerAutomotoras(): Promise<Automotora[]> {
  const csvPath = path.join(__dirname, '..', '..', 'data', 'listado_automotoras.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`No se encontró el archivo: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  return new Promise((resolve, reject) => {
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }, (err, records: Automotora[]) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

function leerTemplate(): string {
  const templatePath = path.join(__dirname, 'base-scraper.ts');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`No se encontró el template: ${templatePath}`);
  }

  return fs.readFileSync(templatePath, 'utf-8');
}

function generarScraper(automotora: Automotora, template: string): string {
  return template
    .replace(/{{AUTOMOTORA_NOMBRE}}/g, automotora.automotora)
    .replace(/{{IMPORT_STAGEHAND}}/g, '../../../src/utils/stagehandConfigV2')
    .replace(/{{IMPORT_SCHEMA}}/g, '../../../src/config/schema');
}

function guardarScraper(automotora: Automotora, contenido: string): string {
  const folderName = sanitizeFolderName(automotora.automotora);
  const scraperFilename = `scraper_${folderName}.ts`;
  
  const scraperPath = path.join(
    __dirname,
    '..',
    '..',
    'automotoras',
    folderName,
    'scripts',
    scraperFilename
  );

  const scraperDir = path.dirname(scraperPath);
  if (!fs.existsSync(scraperDir)) {
    throw new Error(`No existe la carpeta: ${scraperDir}`);
  }

  fs.writeFileSync(scraperPath, contenido, 'utf-8');
  return scraperPath;
}

async function main() {
  console.log('🤖 GENERADOR DE SCRAPERS');
  console.log('='.repeat(70) + '\n');

  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Uso:');
    console.log('  npm run generate:scraper <nombre_automotora>');
    console.log('  npm run generate:scraper all\n');
    console.log('Ejemplos:');
    console.log('  npm run generate:scraper "Derco Center"');
    console.log('  npm run generate:scraper all\n');
    process.exit(1);
  }

  const automorasBuscar = args[0].toLowerCase();
  
  let automotoras: Automotora[];
  let template: string;

  try {
    automotoras = await leerAutomotoras();
    console.log(`✅ Cargadas ${automotoras.length} automotoras\n`);
  } catch (error) {
    console.error(`❌ Error al leer automotoras: ${error}`);
    process.exit(1);
  }

  try {
    template = leerTemplate();
    console.log(`✅ Template cargado\n`);
  } catch (error) {
    console.error(`❌ Error al leer template: ${error}`);
    process.exit(1);
  }

  if (automorasBuscar === 'all') {
    console.log(`📦 Generando scrapers para las ${automotoras.length} automotoras...\n`);

    let generados = 0;
    let errores = 0;

    for (const automotora of automotoras) {
      try {
        const contenido = generarScraper(automotora, template);
        guardarScraper(automotora, contenido);
        const folderName = sanitizeFolderName(automotora.automotora);
        console.log(`✅ ${automotora.automotora.padEnd(30)} -> scraper_${folderName}.ts creado`);
        generados++;
      } catch (error) {
        console.log(`❌ ${automotora.automotora.padEnd(30)} -> Error: ${error}`);
        errores++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN');
    console.log('='.repeat(70));
    console.log(`✅ Generados: ${generados}`);
    console.log(`❌ Errores:   ${errores}`);
    console.log('='.repeat(70));

  } else {
    const automotora = automotoras.find(a => 
      a.automotora.toLowerCase().includes(automorasBuscar) ||
      sanitizeFolderName(a.automotora) === automorasBuscar
    );

    if (!automotora) {
      console.error(`❌ No se encontró la automotora: ${args[0]}`);
      console.log('\n💡 Automotoras disponibles:');
      automotoras.slice(0, 10).forEach(a => console.log(`  - ${a.automotora}`));
      console.log(`  ... y ${automotoras.length - 10} más\n`);
      process.exit(1);
    }

    const contenido = generarScraper(automotora, template);
    guardarScraper(automotora, contenido);
    const folderName = sanitizeFolderName(automotora.automotora);

    console.log(`✅ Scraper generado para: ${automotora.automotora}`);
    console.log(`📁 Ubicación: automotoras/${folderName}/scripts/scraper_${folderName}.ts\n`);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});