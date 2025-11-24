/**
 * Script para crear estructura de carpetas por automotora
 * Autor: Claude + Erick
 * Fecha: 2024-11-24
 * 
 * Este script lee el CSV con las automotoras y crea una estructura
 * organizada de carpetas dentro del proyecto scraping_consecionarias
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface Automotora {
  id: string;
  automotora: string;
  cantidad_sucursales: string;
}

/**
 * Limpia el nombre de la automotora para usarlo como nombre de carpeta.
 * Remueve caracteres especiales y espacios.
 */
function sanitizeFolderName(name: string): string {
  // Convertir a minúsculas
  let sanitized = name.toLowerCase();
  
  // Reemplazar caracteres especiales y espacios por guión bajo
  sanitized = sanitized.replace(/[^\w\s-]/g, '');
  sanitized = sanitized.replace(/[-\s]+/g, '_');
  
  // Remover guiones bajos al inicio y final
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  
  return sanitized;
}

/**
 * Crea un directorio si no existe
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Crea el archivo README para cada automotora
 */
function createReadme(
  autoPath: string,
  autoName: string,
  autoId: string,
  sucursales: string,
  folderName: string
): void {
  const readmeContent = `# ${autoName}

**ID:** ${autoId}
**Sucursales:** ${sucursales}
**Carpeta:** ${folderName}

## Estructura

- \`csv/\` - Archivos CSV con datos de modelos y URLs
- \`scripts/\` - Scripts de scraping específicos
- \`logs/\` - Logs de ejecución de scrapers
- \`results/\` - Resultados de scraping (JSON, CSV)

## Uso

1. Colocar CSV de datos en carpeta \`csv/\`
2. Ejecutar script de scraping desde \`scripts/\`
3. Revisar logs en \`logs/\`
4. Verificar resultados en \`results/\`

---
Creado: setup_automotoras_folders.ts
`;

  fs.writeFileSync(path.join(autoPath, 'README.md'), readmeContent, 'utf-8');
}

/**
 * Crea el índice maestro con todas las automotoras
 */
function createMasterIndex(basePath: string, automotoras: Automotora[]): void {
  let content = `# Índice de Automotoras

Este archivo contiene un índice de todas las automotoras configuradas.

## Lista de Automotoras

| ID | Nombre | Sucursales | Carpeta |
|----|--------|------------|---------|
`;

  // Ordenar por nombre
  const sorted = [...automotoras].sort((a, b) => 
    a.automotora.localeCompare(b.automotora)
  );

  for (const row of sorted) {
    const folderName = sanitizeFolderName(row.automotora);
    content += `| ${row.id} | ${row.automotora} | ${row.cantidad_sucursales} | \`${folderName}\` |\n`;
  }

  const totalSucursales = automotoras.reduce(
    (sum, row) => sum + parseInt(row.cantidad_sucursales), 
    0
  );

  content += `
## Estadísticas

- **Total de automotoras:** ${automotoras.length}
- **Total de sucursales:** ${totalSucursales}

## Estructura de cada carpeta

Cada carpeta de automotora contiene:

\`\`\`
nombre_automotora/
├── csv/          # Datos de entrada (URLs, modelos)
├── scripts/      # Scripts de scraping
├── logs/         # Logs de ejecución
├── results/      # Resultados de scraping
└── README.md     # Información de la automotora
\`\`\`

---
**Generado automáticamente**
`;

  fs.writeFileSync(path.join(basePath, 'INDEX.md'), content, 'utf-8');
  console.log(`📄 Índice maestro creado: ${path.join(basePath, 'INDEX.md')}`);
}

/**
 * Crea la estructura de carpetas para cada automotora
 */
function createFolderStructure(
  csvPath: string, 
  basePath: string = './scraping_consecionarias'
): void {
  // Crear carpeta principal para automotoras si no existe
  const automorasBase = path.join(basePath, 'automotoras');
  ensureDir(automorasBase);

  console.log(`📁 Creando estructura de carpetas en: ${automorasBase}`);
  console.log('-'.repeat(70));

  // Leer el CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const automotoras: Automotora[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📊 Total de automotoras encontradas: ${automotoras.length}\n`);

  // Estadísticas
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Crear estructura para cada automotora
  for (const row of automotoras) {
    const { id: autoId, automotora: autoName, cantidad_sucursales: sucursales } = row;
    
    // Sanitizar nombre para carpeta
    const folderName = sanitizeFolderName(autoName);
    
    // Crear carpeta principal de la automotora
    const autoPath = path.join(automorasBase, folderName);

    try {
      // Verificar si ya existe
      if (fs.existsSync(autoPath)) {
        console.log(`⏭️  [${autoId.padStart(3)}] ${autoName.padEnd(30)} -> Ya existe, saltando...`);
        skippedCount++;
        continue;
      }

      // Crear carpeta principal
      ensureDir(autoPath);

      // Crear subcarpetas
      ensureDir(path.join(autoPath, 'csv'));
      ensureDir(path.join(autoPath, 'scripts'));
      ensureDir(path.join(autoPath, 'logs'));
      ensureDir(path.join(autoPath, 'results'));

      // Crear README
      createReadme(autoPath, autoName, autoId, sucursales, folderName);

      console.log(`✅ [${autoId.padStart(3)}] ${autoName.padEnd(30)} -> ${folderName}`);
      createdCount++;

    } catch (error) {
      console.log(`❌ [${autoId.padStart(3)}] ${autoName.padEnd(30)} -> ERROR: ${error}`);
      errorCount++;
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN');
  console.log('='.repeat(70));
  console.log(`✅ Carpetas creadas:    ${createdCount}`);
  console.log(`⏭️  Carpetas existentes: ${skippedCount}`);
  console.log(`❌ Errores:             ${errorCount}`);
  console.log(`📁 Total procesadas:    ${automotoras.length}`);
  console.log('='.repeat(70));

  // Crear índice maestro
  createMasterIndex(automorasBase, automotoras);

  console.log(`\n✨ ¡Estructura creada exitosamente en: ${automorasBase}!`);
}

// Ejecución principal
const csvFile = 'listado_automotoras.csv';
const basePath = '.'; // Usar la estructura existente

// Verificar que el CSV existe
if (!fs.existsSync(csvFile)) {
  console.error(`❌ ERROR: No se encontró el archivo ${csvFile}`);
  console.error(`   Por favor, coloca el archivo CSV en la raíz del proyecto.`);
  process.exit(1);
}

// Verificar que existe la carpeta scraping_consecionarias
if (!fs.existsSync(basePath)) {
  console.error(`❌ ERROR: No se encontró la carpeta ${basePath}`);
  console.error(`   Por favor, ejecuta este script desde la raíz del proyecto.`);
  process.exit(1);
}

// Ejecutar
console.log('🚀 Iniciando creación de estructura de carpetas...\n');
createFolderStructure(csvFile, basePath);