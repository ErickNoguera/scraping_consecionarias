#!/usr/bin/env node
/**
 * Script Helper para ejecutar scrapers de automotoras
 * Uso: npm run scrape <nombre_automotora>
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sanitizeFolderName(name: string): string {
  let sanitized = name.toLowerCase();
  sanitized = sanitized.replace(/[^\w\s-]/g, '');
  sanitized = sanitized.replace(/[-\s]+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  return sanitized;
}

function listarAutomotoras() {
  const automorasPath = path.join(__dirname, '..', '..', 'automotoras');
  const carpetas = fs.readdirSync(automorasPath)
    .filter(file => fs.statSync(path.join(automorasPath, file)).isDirectory())
    .sort();
  
  console.log('\n📋 AUTOMOTORAS DISPONIBLES:');
  console.log('='.repeat(70));
  carpetas.forEach((carpeta, i) => {
    const scraperFilename = `scraper_${carpeta}.ts`;
    const scraperPath = path.join(automorasPath, carpeta, 'scripts', scraperFilename);
    const existe = fs.existsSync(scraperPath);
    const status = existe ? '✅' : '❌';
    console.log(`${status} [${String(i + 1).padStart(2)}] ${carpeta.padEnd(30)} (${scraperFilename})`);
  });
  console.log('='.repeat(70));
  console.log(`\nTotal: ${carpetas.length} automotoras\n`);
}

function ejecutarScraper(automoraInput: string) {
  const folderName = sanitizeFolderName(automoraInput);
  const scraperFilename = `scraper_${folderName}.ts`;
  const scraperPath = path.join(__dirname, '..', '..', 'automotoras', folderName, 'scripts', scraperFilename);
  
  if (!fs.existsSync(scraperPath)) {
    console.error(`❌ No se encontró el scraper: ${scraperPath}`);
    console.log('\n💡 Usa: npm run scrape list');
    console.log('   Para ver las automotoras disponibles\n');
    process.exit(1);
  }

  console.log(`\n🚀 Ejecutando scraper de: ${automoraInput}`);
  console.log(`📄 Archivo: ${scraperFilename}\n`);
  console.log('='.repeat(70) + '\n');

  const child = spawn('npx', ['tsx', scraperPath], {
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ Scraper finalizado exitosamente');
      console.log('='.repeat(70) + '\n');
    } else {
      console.log('\n' + '='.repeat(70));
      console.log(`❌ Scraper terminó con errores (código: ${code})`);
      console.log('='.repeat(70) + '\n');
    }
  });
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'list' || args[0] === '--list' || args[0] === '-l') {
  listarAutomotoras();
} else {
  ejecutarScraper(args[0]);
}