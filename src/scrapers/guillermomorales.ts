// IMPORTANTE: Usa stagehandConfigV2 para NO afectar tu scraper de Astara
import { createStagehand } from "../utils/stagehandConfigV2";
import { writeCSV, appendToMerged } from "../utils/writer";
import { normalize } from "../utils/normalizer";

const BRANDS_CONFIG: Record<string, number> = {
  'mitsubishi': -1,
  'peugeot': -1,
  'jeep': -1,
  'ram': -1,
  'citroen': -1,
  'jmc': -1,
  'ssangyong': -1,
  'opel': -1,
  'fiat': -1,
  'gac': -1,
  'chery': -1,
  'byd': -1,
  'leapmotor': -1,
  'exeed': -1,
};

interface CarData {
  brand: string;
  model: string;
  version: string;
  precio_lista: string;
  bono_todo_medio_pago: string | null;
  bono_financiamiento: string | null;
  precio_todo_medio_pago: string | null;
  precio_con_financiamiento: string | null;
  url: string;
}

function isValidEntry(car: CarData): boolean {
  const lista = parseInt(car.precio_lista || '0', 10);
  const bonoMedio = parseInt(car.bono_todo_medio_pago || '0', 10);
  const bonoFin = parseInt(car.bono_financiamiento || '0', 10);

  if (!lista || lista <= 0) return false;
  if (bonoMedio > lista * 0.3) return false;
  if (bonoFin > lista * 0.3) return false;
  
  return true;
}

function extractNumbers(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d]/g, '');
  return cleaned || null;
}

function calculatePrecioFinal(precioLista: string, bono: string): string {
  return (parseInt(precioLista, 10) - parseInt(bono, 10)).toString();
}

export async function scrapeGuillermoMorales() {
  console.log("🚀 Scraper Guillermo Morales - Versión FUNCIONAL");
  console.log("✅ Basado en estructura real del sitio\n");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'es-CL,es;q=0.9'
  });
  
  const allCars: CarData[] = [];
  let totalDescartados = 0;
  
  for (const [brand, maxModels] of Object.entries(BRANDS_CONFIG)) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🏷️ Marca: ${brand.toUpperCase()}`);
    console.log("=".repeat(80));
    
    try {
      const brandUrl = `https://guillermomorales.cl/autos-nuevos/${brand}`;
      console.log(`🌐 ${brandUrl}`);
      
      await page.goto(brandUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 120000
      });
      await page.waitForTimeout(5000); // Esperar JS
      
      console.log(`✅ Cargado\n`);
      
      // EXTRAER MODELOS - Estructura real: div.card-autos
      console.log(`🔍 Extrayendo modelos...`);
      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(2000);
      
      const modelCards = await page.locator('div.card-autos').all();
      console.log(`   📦 ${modelCards.length} cards encontradas`);
      
      const models: Array<{ model_name: string; url: string }> = [];
      
      for (const card of modelCards) {
        try {
          const modeloEl = await card.locator('p.modelo').first();
          const modelName = await modeloEl.textContent();
          
          const linkEl = await card.locator('a[href*="/autos-nuevos/"]').first();
          const href = await linkEl.getAttribute('href');
          
          if (modelName && href) {
            const fullUrl = href.startsWith('http') ? href : `https://guillermomorales.cl${href}`;
            models.push({ 
              model_name: modelName.trim(), 
              url: fullUrl 
            });
          }
        } catch (e) {
          // Card sin datos completos
        }
      }
      
      const modelsToProcess = maxModels > 0 ? models.slice(0, maxModels) : models;
      
      console.log(`✅ ${modelsToProcess.length} modelos:\n`);
      modelsToProcess.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.model_name}`);
      });
      
      if (modelsToProcess.length === 0) {
        console.log(`❌ Sin modelos para ${brand}`);
        continue;
      }
      
      // PROCESAR CADA MODELO
      for (let i = 0; i < modelsToProcess.length; i++) {
        const modelInfo = modelsToProcess[i];
        
        console.log(`\n${"─".repeat(70)}`);
        console.log(`📦 [${i + 1}/${modelsToProcess.length}] ${modelInfo.model_name.toUpperCase()}`);
        
        try {
          await page.goto(modelInfo.url, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000
          });
          await page.waitForTimeout(4000);
          
          console.log(`   ✅ Página cargada`);
          
          // Scroll a tabla
          await page.evaluate(() => {
            window.scrollTo(0, 600);
            const table = document.querySelector('table');
            if (table) table.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
          await page.waitForTimeout(2000);
          
          console.log(`   🔍 Extrayendo versiones y precios...\n`);
          
          // EXTRAER VERSIONES DE LOS DROPDOWNS
          const versionSelects = await page.locator('select[name="version"]').all();
          console.log(`   📊 ${versionSelects.length} columnas de versiones`);
          
          const versions: Array<{
            version: string;
            precio_lista: string;
            bono_financiamiento: string | null;
            bono_fidelizacion: string | null;
          }> = [];
          
          // Por cada columna (dropdown)
          for (let colIdx = 0; colIdx < versionSelects.length; colIdx++) {
            try {
              const select = versionSelects[colIdx];
              
              // Obtener versión seleccionada
              const selectedOption = await select.locator('option[selected]').first();
              const versionName = await selectedOption.textContent();
              
              if (!versionName) continue;
              
              console.log(`   Columna ${colIdx + 1}: ${versionName.trim()}`);
              
              // Buscar fila de "Precio Lista"
              const precioRow = await page.locator('tr').filter({ hasText: 'Precio Lista' }).first();
              const precioCells = await precioRow.locator('td.center').all();
              
              if (colIdx < precioCells.length) {
                const precioText = await precioCells[colIdx].textContent();
                const precio = extractNumbers(precioText);
                
                // Buscar fila de "Bono Financiamiento"
                let bonoFin: string | null = null;
                try {
                  const bonoFinRow = await page.locator('tr').filter({ hasText: 'Bono Financiamiento' }).first();
                  const bonoFinCells = await bonoFinRow.locator('td.center').all();
                  if (colIdx < bonoFinCells.length) {
                    const bonoFinText = await bonoFinCells[colIdx].textContent();
                    bonoFin = extractNumbers(bonoFinText);
                  }
                } catch (e) {
                  // No hay bono financiamiento
                }
                
                // Buscar fila de "Bono de Fidelización" o "Bono Todo Medio"
                let bonoFid: string | null = null;
                try {
                  const bonoFidRow = await page.locator('tr').filter({ hasText: /Bono.*Fidelización|Bono Todo Medio/i }).first();
                  const bonoFidCells = await bonoFidRow.locator('td.center').all();
                  if (colIdx < bonoFidCells.length) {
                    const bonoFidText = await bonoFidCells[colIdx].textContent();
                    bonoFid = extractNumbers(bonoFidText);
                  }
                } catch (e) {
                  // No hay bono fidelización
                }
                
                if (precio) {
                  versions.push({
                    version: versionName.trim(),
                    precio_lista: precio,
                    bono_financiamiento: bonoFin,
                    bono_fidelizacion: bonoFid
                  });
                }
              }
              
            } catch (e) {
              console.log(`   ⚠️ Error en columna ${colIdx + 1}`);
            }
          }
          
          console.log(`\n   ✅ ${versions.length} versiones extraídas\n`);
          
          if (versions.length === 0) {
            console.log(`   ❌ Sin precios`);
            continue;
          }
          
          // VALIDAR Y GUARDAR
          const versionesValidas: CarData[] = [];
          let descartadasModelo = 0;
          
          versions.forEach((v: any, idx: number) => {
            const precioLista = v.precio_lista;
            const bonoFin = v.bono_financiamiento;
            const bonoFid = v.bono_fidelizacion;
            
            // Sumar bonos si existen
            let bonoTotal: string | null = null;
            if (bonoFin && bonoFid) {
              bonoTotal = (parseInt(bonoFin) + parseInt(bonoFid)).toString();
            } else if (bonoFin) {
              bonoTotal = bonoFin;
            } else if (bonoFid) {
              bonoTotal = bonoFid;
            }
            
            const carData: CarData = {
              brand: brand.toUpperCase(),
              model: modelInfo.model_name.toUpperCase(),
              version: v.version.toUpperCase(),
              precio_lista: precioLista,
              bono_financiamiento: bonoFin,
              bono_todo_medio_pago: bonoFid,
              precio_con_financiamiento: bonoTotal ? calculatePrecioFinal(precioLista, bonoTotal) : null,
              precio_todo_medio_pago: null,
              url: modelInfo.url
            };
            
            console.log(`   ${idx + 1}. ${carData.version}`);
            console.log(`      💰 Lista: $${parseInt(carData.precio_lista).toLocaleString('es-CL')}`);
            if (bonoFin) {
              console.log(`      🏦 Bono Financ: $${parseInt(bonoFin).toLocaleString('es-CL')}`);
            }
            if (bonoFid) {
              console.log(`      🎁 Bono Fideliz: $${parseInt(bonoFid).toLocaleString('es-CL')}`);
            }
            if (bonoTotal) {
              console.log(`      💵 Precio Final: $${parseInt(carData.precio_con_financiamiento!).toLocaleString('es-CL')}`);
            }
            
            if (isValidEntry(carData)) {
              versionesValidas.push(carData);
              console.log(`      ✅ Válida`);
            } else {
              descartadasModelo++;
              totalDescartados++;
              console.log(`      ❌ Descartada`);
            }
          });
          
          if (descartadasModelo > 0) {
            console.log(`\n   ⚠️ ${descartadasModelo} descartadas`);
          }
          
          allCars.push(...versionesValidas);
          console.log(`   📊 ${versionesValidas.length} válidas guardadas`);
          
        } catch (error) {
          console.error(`   ❌ Error: ${error}`);
        }
        
        await page.waitForTimeout(2000);
      }
      
    } catch (error) {
      console.error(`❌ Error en ${brand}: ${error}`);
    }
  }
  
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(80));
  console.log(`Total extraído: ${allCars.length + totalDescartados}`);
  console.log(`Versiones válidas: ${allCars.length}`);
  console.log(`Descartadas: ${totalDescartados}`);
  
  if (allCars.length > 0) {
    console.log(`✅ Tasa éxito: ${(allCars.length / (allCars.length + totalDescartados) * 100).toFixed(1)}%`);
    
    const normalized = allCars.map((r: CarData) => normalize(r, "Guillermo Morales"));
    writeCSV("guillermomorales.csv", normalized);
    appendToMerged(normalized);
    console.log("\n✅ Guardado: ./output/guillermomorales.csv");
  } else {
    console.log("\n⚠️ Sin datos");
  }
  
  await stagehand.close();
  console.log("\n🎉 Completado!");
}

import { fileURLToPath } from 'url';
const isMainModule = process.argv[1]?.replace(/\\/g, '/').includes('guillermomorales');

if (isMainModule) {
  scrapeGuillermoMorales()
    .then(() => {
      console.log("\n✅ Finalizado");
      process.exit(0);
    })
    .catch(err => {
      console.error("\n❌ Error:", err);
      process.exit(1);
    });
}