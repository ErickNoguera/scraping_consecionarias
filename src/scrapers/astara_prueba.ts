import { createStagehand } from "../utils/stagehandConfig";
import { writeCSV, appendToMerged } from "../utils/writer";
import { normalize } from "../utils/normalizer";

const BRANDS = ['jeep', 'ram'];  // Solo 2 marcas para prueba - luego cambia a todas

export async function scrapeAstara() {
  console.log("🚀 Iniciando scraper de Astara...");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  let allCars: any[] = [];
  
  for (const brand of BRANDS) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🏷️ Procesando marca: ${brand.toUpperCase()}`);
    console.log("=".repeat(80));
    
    try {
      const brandUrl = `https://astararetail.cl/${brand}/`;
      console.log(`📍 Navegando a: ${brandUrl}`);
      await page.goto(brandUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Extraer URLs de modelos - filtro mejorado
      const modelUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const urls = new Set<string>();
        
        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          const url = new URL(href);
          const path = url.pathname;
          
          // Debe incluir el dominio correcto
          if (!href.includes('astararetail.cl/')) return;
          
          // Filtrar páginas no deseadas
          if (path.includes('seminuevos') || 
              path.includes('liquidacion') ||
              path.includes('ofertas') ||
              path.includes('servicio') ||
              path.includes('flotas') ||
              path.includes('sucursales') ||
              path.includes('politicas') ||
              path.includes('cookies') ||
              path.includes('buscador')) {
            return;
          }
          
          // Solo si tiene guión (formato: jeep-avenger, ram-700, etc)
          const parts = path.split('/').filter(Boolean);
          if (parts.length === 1 && parts[0].includes('-')) {
            urls.add(href.replace(/\/$/, ''));  // Sin trailing slash
          }
        });
        
        return Array.from(urls);
      });
      
      console.log(`✅ Encontrados ${modelUrls.length} modelos`);
      
      if (modelUrls.length === 0) {
        console.log(`⚠️ No se encontraron modelos para ${brand}`);
        continue;
      }
      
      // Mostrar modelos encontrados
      console.log('\n📋 Modelos:');
      modelUrls.forEach((url, i) => {
        const name = url.split('/').filter(Boolean).pop();
        console.log(`   ${i + 1}. ${name}`);
      });
      
      // Visitar cada modelo
      console.log(`\n🔄 Extrayendo versiones...\n`);
      
      for (let i = 0; i < modelUrls.length; i++) {
        const modelUrl = modelUrls[i];
        const modelName = modelUrl.split('/').filter(Boolean).pop() || 'unknown';
        
        try {
          console.log(`[${i + 1}/${modelUrls.length}] 📦 ${modelName.toUpperCase()}`);
          await page.goto(modelUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
          
          // Prompt mejorado basado en la estructura real de Astara
          const result = await page.extract(`
Busca TODAS las versiones de vehículos en esta página.

Para cada versión encontrada, extrae estos datos EXACTOS:

1. brand: "${brand}"
2. model: nombre del modelo (ejemplo: "AVENGER", "COMPASS", "700", "1500")
3. version: versión específica (ejemplo: "ALTITUDE 1.2T MT", "SPORT 1.3 AT")
4. precio_lista: busca "Precio lista:", "Precio sin bono:" o similar. SOLO el número sin símbolo $ ni puntos (ejemplo: si ves "$24.990.000" retorna "24990000")
5. bono_todo_medio_pago: busca "bono todo medio de pago", "bono marca" o similar. SOLO el número sin símbolo $ ni puntos (ejemplo: si ves "$1.000.000" retorna "1000000")
6. bono_financiamiento: busca "bono financiamiento", "bono Santander", "bono con financiamiento" o similar. SOLO el número sin símbolo $ ni puntos (ejemplo: si ves "$2.000.000" retorna "2000000")
7. url: "${modelUrl}"

IMPORTANTE:
- Precios y bonos deben ser SOLO NÚMEROS sin "$" ni "." (ejemplo: 24990000, no $24.990.000)
- Si hay múltiples versiones en la página, retorna TODAS en un array
- Si no encuentras un valor, usa null
- NO inventes datos

Retorna ÚNICAMENTE un array JSON válido:
[
  {
    "brand": "${brand}",
    "model": "nombre",
    "version": "versión",
    "precio_lista": "número",
    "bono_todo_medio_pago": "número",
    "bono_financiamiento": "número",
    "url": "${modelUrl}"
  }
]
          `);
          
          try {
            let content = '';
            
            // Extraer contenido según el formato de respuesta
            if (typeof result === 'string') {
              content = result;
            } else if (typeof result === 'object') {
              const anyResult = result as any;
              
              if (anyResult.extraction) {
                content = anyResult.extraction;
              } else if (anyResult.choices?.[0]?.message?.content) {
                content = anyResult.choices[0].message.content;
              } else if (anyResult.content) {
                content = anyResult.content;
              } else {
                content = JSON.stringify(result);
              }
            }
            
            // Extraer JSON
            const jsonMatch = content.match(/\[[\s\S]*?\]/);
            
            if (jsonMatch) {
              const versions = JSON.parse(jsonMatch[0]);
              
              if (versions.length > 0) {
                console.log(`   ✅ ${versions.length} versión(es) extraída(s)`);
                
                // Mostrar preview
                versions.forEach((v: any, idx: number) => {
                  console.log(`      ${idx + 1}. ${v.version || 'N/A'}`);
                  console.log(`         Precio lista: $${v.precio_lista || 'N/A'}`);
                  console.log(`         Bono medio pago: $${v.bono_todo_medio_pago || 'N/A'}`);
                  console.log(`         Bono financ: $${v.bono_financiamiento || 'N/A'}`);
                });
                
                allCars.push(...versions);
              } else {
                console.log(`   ⚠️ No se encontraron versiones`);
              }
            } else {
              console.log(`   ⚠️ No se pudo extraer JSON`);
              console.log(`   Debug: ${content.substring(0, 200)}`);
            }
          } catch (e) {
            console.error(`   ❌ Error parseando:`, e);
          }
          
        } catch (error) {
          console.error(`   ❌ Error en modelo ${modelName}:`, error);
        }
        
        // Pausa entre modelos
        await page.waitForTimeout(1500);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando marca ${brand}:`, error);
    }
  }
  
  // Resumen final
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(80));
  console.log(`Total de versiones extraídas: ${allCars.length}`);
  
  if (allCars.length > 0) {
    // Estadísticas
    const conPrecios = allCars.filter(c => c.precio_lista).length;
    const conBonoMedio = allCars.filter(c => c.bono_todo_medio_pago).length;
    const conBonoFinanc = allCars.filter(c => c.bono_financiamiento).length;
    
    console.log(`\nDatos extraídos:`);
    console.log(`  - Con precio lista: ${conPrecios}/${allCars.length}`);
    console.log(`  - Con bono medio pago: ${conBonoMedio}/${allCars.length}`);
    console.log(`  - Con bono financiamiento: ${conBonoFinanc}/${allCars.length}`);
    
    // Normalizar y guardar
    const normalized = allCars.map((r: any) => normalize(r, "Astara"));
    writeCSV("astara.csv", normalized);
    appendToMerged(normalized);
    console.log("\n✅ CSV guardado en ./output/astara.csv");
  } else {
    console.log("\n⚠️ No se extrajeron datos");
  }
  
  await stagehand.close();
}

// Para ejecutar directamente
if (process.argv[1]?.endsWith('astara.ts')) {
  scrapeAstara()
    .then(() => console.log("\n✅ Completado"))
    .catch(console.error);
}