import { createStagehand } from "../utils/stagehandConfig";
import { writeCSV } from "../utils/writer";
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

interface CarData {
  marca: string;
  modelo: string;
  version: string;
  precio_lista: string | null;
  bono_marca: string | null;
  bono_financiamiento: string | null;
  url: string;
  dealer: string;
}

export async function completeAstaraData() {
  console.log("🔄 Iniciando completado de datos de Astara (Versión 2)...");
  
  const csvPath = path.join(process.cwd(), 'output', 'astara.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error("❌ No se encontró el archivo output/astara.csv");
    return;
  }
  
  console.log("📖 Leyendo CSV existente...");
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  const cars: any[] = [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    const car: any = {};
    headers.forEach((header, index) => {
      car[header] = values[index] || null;
    });
    if (car.url) cars.push(car);
  }
  
  console.log(`✅ Encontrados ${cars.length} autos en el CSV`);
  
  const carsToComplete = cars.filter(car => 
    !car.precio_lista || car.precio_lista === 'null' || car.precio_lista === ''
  );
  
  console.log(`📝 Autos sin datos completos: ${carsToComplete.length}`);
  
  if (carsToComplete.length === 0) {
    console.log("🎉 Todos los autos ya tienen datos completos!");
    return;
  }
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  let completed = 0;
  let failed = 0;
  
  console.log("\n" + "=".repeat(60));
  console.log("🚀 Iniciando extracción de precios y bonos");
  console.log("=".repeat(60) + "\n");
  
  for (let i = 0; i < carsToComplete.length; i++) {
    const car = carsToComplete[i];
    console.log(`\n[${i + 1}/${carsToComplete.length}] ${car.marca} ${car.modelo} ${car.version}`);
    console.log(`🔗 ${car.url}`);
    
    try {
      await page.goto(car.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
      
      // Cierra popups
      await closePopups(page);
      
      // NUEVA ESTRATEGIA: Extraer el HTML completo y procesarlo aquí
      const htmlContent = await page.content();
      
      // Procesa el HTML en Node.js (no en el navegador)
      const prices = extractPricesFromHTML(htmlContent);
      
      let hasData = false;
      
      if (prices.precio_lista) {
        car.precio_lista = prices.precio_lista;
        console.log(`  💰 Precio lista: $${prices.precio_lista}`);
        hasData = true;
      }
      
      if (prices.precio_todo_medio) {
        console.log(`  💵 Precio todo medio: $${prices.precio_todo_medio}`);
        hasData = true;
      }
      
      if (prices.precio_financiamiento) {
        console.log(`  🏦 Precio financiamiento: $${prices.precio_financiamiento}`);
        hasData = true;
      }
      
      if (prices.bono_todo_medio) {
        car.bono_marca = prices.bono_todo_medio;
        console.log(`  🎁 Bono todo medio: $${prices.bono_todo_medio}`);
        hasData = true;
      }
      
      if (prices.bono_financiamiento) {
        car.bono_financiamiento = prices.bono_financiamiento;
        console.log(`  🎫 Bono financiamiento: $${prices.bono_financiamiento}`);
        hasData = true;
      }
      
      if (hasData) {
        completed++;
        console.log(`  ✅ OK (${completed}/${carsToComplete.length})`);
      } else {
        failed++;
        console.log(`  ⚠️ Sin datos`);
      }
      
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${error?.message || 'Error desconocido'}`);
    }
    
    await page.waitForTimeout(1000);
    
    // Guarda progreso cada 20 autos
    if ((i + 1) % 20 === 0) {
      saveCarsToCSV(cars, `astara_progreso_${i + 1}.csv`);
      console.log(`\n💾 Progreso guardado (${i + 1}/${carsToComplete.length})\n`);
    }
  }
  
  await stagehand.close();
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMEN");
  console.log("=".repeat(60));
  console.log(`✅ Completados: ${completed}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`📄 Total: ${cars.length}`);
  console.log("=".repeat(60) + "\n");
  
  saveCarsToCSV(cars, "astara_completo.csv");
  console.log("✅ Archivo final: output/astara_completo.csv");
}

// Extrae precios del HTML usando regex (fuera del navegador)
function extractPricesFromHTML(html: string) {
  const result = {
    precio_lista: null as string | null,
    precio_todo_medio: null as string | null,
    precio_financiamiento: null as string | null,
    bono_todo_medio: null as string | null,
    bono_financiamiento: null as string | null
  };
  
  // Elimina tags HTML para trabajar con texto plano
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  const patterns = [
    { key: 'precio_lista', regex: /Precio\s+lista[:\s]*\$?\s*([\d.]+)/i },
    { key: 'precio_todo_medio', regex: /Precio\s+todo\s+medio\s+de\s+pago[:\s]*\$?\s*([\d.]+)/i },
    { key: 'precio_financiamiento', regex: /Precio\s+con\s+financiamiento[:\s]*\$?\s*([\d.]+)/i },
    { key: 'bono_todo_medio', regex: /Bono\s+todo\s+medio\s+de\s+pago[:\s]*\$?\s*([\d.]+)/i },
    { key: 'bono_financiamiento', regex: /Bono\s+Financiamiento[:\s]*\$?\s*([\d.]+)/i }
  ];
  
  patterns.forEach(p => {
    const match = text.match(p.regex);
    if (match && match[1]) {
      result[p.key as keyof typeof result] = match[1].replace(/\./g, '');
    }
  });
  
  return result;
}

function saveCarsToCSV(cars: any[], filename: string) {
  const updatedCars: CarData[] = cars.map(c => ({
    marca: c.marca || '',
    modelo: c.modelo || '',
    version: c.version || '',
    precio_lista: c.precio_lista || null,
    bono_marca: c.bono_marca || null,
    bono_financiamiento: c.bono_financiamiento || null,
    url: c.url || '',
    dealer: c.dealer || 'Astara'
  }));
  writeCSV(filename, updatedCars);
}

async function closePopups(page: any) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '.dialog-close-button',
    '[aria-label="Close"]'
  ];
  
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 800 });
      await page.waitForTimeout(300);
    } catch (e) {
      // Ignorar
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1]?.endsWith('astara-complete-v2.ts')) {
  completeAstaraData()
    .then(() => console.log("\n✅ Completado"))
    .catch((err) => {
      console.error("\n❌", err);
      process.exit(1);
    });
}