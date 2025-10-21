import { createStagehand } from "../utils/stagehandConfig";
import { writeCSV, appendToMerged } from "../utils/writer";
import { normalize } from "../utils/normalizer";

const BRANDS = ['fiat', 'mitsubishi'];  // Solo 2 marcas para prueba - luego cambia a todas

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
          
          // Prompt mejorado - solo sección visual con imágenes
          const result = await page.extract(`
IMPORTANTE: Busca SOLO en la sección "Elige una versión" que tiene las imágenes de los vehículos. 
IGNORA la sección de texto que aparece más abajo en la página.

Para cada versión en esa sección visual, extrae:

1. brand: "${brand}"
2. model: nombre del modelo (ejemplo: "AVENGER", "COMPASS", "700", "1500")
3. version: versión específica (ejemplo: "ALTITUDE 1.2T MT", "SPORT 1.3 AT")
4. precio_lista: el número que aparece en "Precio lista $..." SOLO números sin $ ni puntos (ejemplo: si ves "$24.990.000" retorna "24990000")
5. bono_todo_medio_pago: el número en "Bono todo medio de pago $..." SOLO números sin $ ni puntos (ejemplo: si ves "$2.000.000" retorna "2000000")
6. bono_financiamiento: el número en "Bono Financiamiento $..." SOLO números sin $ ni puntos (ejemplo: si ves "$2.000.000" retorna "2000000")

REGLAS CRÍTICAS:
- Precios/bonos: SOLO NÚMEROS sin "$" ni "." (ejemplo: 24990000)
- Si no encuentras un bono, usa null
- NO incluyas el campo "url"
- NO incluyas el campo "dealer"
- NO repitas versiones
- Solo extrae de la sección con imágenes, NO del texto posterior

Retorna array JSON:
[
  {
    "brand": "${brand}",
    "model": "nombre",
    "version": "versión",
    "precio_lista": "número",
    "bono_todo_medio_pago": "número o null",
    "bono_financiamiento": "número o null"
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
              
              // Filtrar duplicados por version (por si acaso)
              const uniqueVersions = versions.reduce((acc: any[], current: any) => {
                const exists = acc.find(v => 
                  v.version === current.version && 
                  v.model === current.model
                );
                if (!exists) {
                  acc.push(current);
                }
                return acc;
              }, []);
              
              if (uniqueVersions.length > 0) {
                console.log(`   ✅ ${uniqueVersions.length} versión(es) extraída(s)`);
                
                // Mostrar preview
                uniqueVersions.forEach((v: any, idx: number) => {
                  console.log(`      ${idx + 1}. ${v.version || 'N/A'}`);
                  console.log(`         Precio lista: ${v.precio_lista || 'N/A'}`);
                  console.log(`         Bono medio pago: ${v.bono_todo_medio_pago || 'N/A'}`);
                  console.log(`         Bono financ: ${v.bono_financiamiento || 'N/A'}`);
                });
                
                allCars.push(...uniqueVersions);
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
    
    // Limpiar campos innecesarios antes de normalizar
    const cleanedCars = allCars.map(car => {
      const { url, dealer, ...rest } = car;  // Eliminar url y dealer
      return rest;
    });
    
    // Normalizar y guardar
    const normalized = cleanedCars.map((r: any) => normalize(r, "Astara"));
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