/**
 * Script para listar y verificar la estructura de carpetas de automotoras
 * Autor: Claude + Erick
 * Fecha: 2024-11-24
 */

import * as fs from 'fs';
import * as path from 'path';

interface IncompleteFolder {
  folder: string;
  missing: string[];
  hasReadme: boolean;
}

/**
 * Lista la estructura de carpetas de automotoras
 */
function listAutomotorasStructure(basePath: string = './automotoras'): void {
  if (!fs.existsSync(basePath)) {
    console.log(`❌ La carpeta ${basePath} no existe.`);
    console.log('   Ejecuta primero el script setup_automotoras_folders.ts');
    return;
  }

  console.log(`📁 Estructura de carpetas en: ${basePath}`);
  console.log('='.repeat(70));

  // Obtener todas las carpetas de automotoras
  const automorasFolders = fs.readdirSync(basePath)
    .filter(file => {
      const fullPath = path.join(basePath, file);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();

  console.log(`\n📊 Total de automotoras: ${automorasFolders.length}\n`);

  const expectedFolders = ['csv', 'scripts', 'logs', 'results'];

  automorasFolders.forEach((folderName, index) => {
    const folderPath = path.join(basePath, folderName);
    
    // Verificar subcarpetas esperadas
    const existingFolders = fs.readdirSync(folderPath)
      .filter(file => {
        const fullPath = path.join(folderPath, file);
        return fs.statSync(fullPath).isDirectory();
      });

    // Verificar README
    const readmeExists = fs.existsSync(path.join(folderPath, 'README.md'));

    // Estado de la estructura
    const allOk = expectedFolders.every(f => existingFolders.includes(f)) && readmeExists;
    const status = allOk ? '✅' : '⚠️';

    console.log(`${status} [${String(index + 1).padStart(2)}] ${folderName}`);

    // Mostrar detalles si hay problemas
    if (!allOk) {
      const missing = expectedFolders.filter(f => !existingFolders.includes(f));
      if (missing.length > 0) {
        console.log(`     ⚠️  Faltan carpetas: ${missing.join(', ')}`);
      }
      if (!readmeExists) {
        console.log(`     ⚠️  Falta README.md`);
      }
    }
  });

  console.log('\n' + '='.repeat(70));
}

/**
 * Verifica que todas las carpetas tengan la estructura completa
 */
function verifyStructure(basePath: string = './automotoras'): void {
  if (!fs.existsSync(basePath)) {
    console.log(`❌ La carpeta ${basePath} no existe.`);
    return;
  }

  const automorasFolders = fs.readdirSync(basePath)
    .filter(file => {
      const fullPath = path.join(basePath, file);
      return fs.statSync(fullPath).isDirectory();
    });

  const expectedFolders = ['csv', 'scripts', 'logs', 'results'];

  let complete = 0;
  let incomplete = 0;
  const incompleteList: IncompleteFolder[] = [];

  automorasFolders.forEach(folderName => {
    const folderPath = path.join(basePath, folderName);
    
    const existingFolders = fs.readdirSync(folderPath)
      .filter(file => {
        const fullPath = path.join(folderPath, file);
        return fs.statSync(fullPath).isDirectory();
      });

    const readmeExists = fs.existsSync(path.join(folderPath, 'README.md'));
    const isComplete = expectedFolders.every(f => existingFolders.includes(f)) && readmeExists;

    if (isComplete) {
      complete++;
    } else {
      incomplete++;
      const missing = expectedFolders.filter(f => !existingFolders.includes(f));
      incompleteList.push({
        folder: folderName,
        missing,
        hasReadme: readmeExists,
      });
    }
  });

  console.log('\n📊 VERIFICACIÓN DE ESTRUCTURA');
  console.log('='.repeat(70));
  console.log(`✅ Completas:   ${complete}`);
  console.log(`⚠️  Incompletas: ${incomplete}`);
  console.log(`📁 Total:       ${automorasFolders.length}`);

  if (incompleteList.length > 0) {
    console.log('\n⚠️  CARPETAS INCOMPLETAS:');
    incompleteList.forEach(item => {
      console.log(`\n   📁 ${item.folder}`);
      if (item.missing.length > 0) {
        console.log(`      - Faltan: ${item.missing.join(', ')}`);
      }
      if (!item.hasReadme) {
        console.log(`      - Falta: README.md`);
      }
    });
  }

  console.log('='.repeat(70));
}

// Ejecución principal
console.log('🔍 Listando estructura de automotoras...\n');
console.log(`📍 Directorio de trabajo: ${process.cwd()}\n`);
listAutomotorasStructure();
verifyStructure();