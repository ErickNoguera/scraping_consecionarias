import { scrapeAstara } from "./scrapers/astara";
import { fileURLToPath } from 'url';

async function main() {
  console.log("Iniciando scrapers...\n");
  
  try { 
    await scrapeAstara(); 
  } catch (e) { 
    console.error('Astara failed:', e); 
  }
  
  console.log('\nTodos los scrapers han finalizado.');
}

// Versión compatible con Windows
const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');

if (isMainModule) {
  main().catch(console.error);
}