// astara_scraper_fixed.ts - Versión corregida para manejar respuestas correctamente
import { createStagehand } from "../utils/stagehandConfig";

interface VersionData {
  modelo: string;
  version: string;
  url: string;
  precioLista: string;
  bonoTodoMedioPago: string;
  bonoFinanciamiento: string;
}

// Función auxiliar para extraer contenido de la respuesta
function extractContent(response: any): string {
  if (typeof response === 'string') {
    return response;
  }
  
  // Si es un objeto con estructura de respuesta de Claude
  if (response?.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }
  
  // Si es otro tipo de objeto
  return JSON.stringify(response);
}

async function scrapeModelVersions(page: any, url: string, modelName: string): Promise<VersionData[]> {
  console.log(`\n📄 Scrapeando modelo: ${modelName}`);
  console.log(`🔗 URL: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // ESTRATEGIA 1: Buscar selectores o botones de versiones
    console.log(`\n🔍 Paso 1: Buscando selectores de versiones...`);
    
    const hasVersionSelectorResponse = await page.extract(`
      ¿Esta página tiene un selector, dropdown o botones para cambiar entre diferentes versiones del vehículo?
      Responde SOLO "SI" o "NO" seguido de una breve descripción del elemento si existe.
      Ejemplo: "SI - Hay un dropdown con opciones de versiones"
      Ejemplo: "NO - Solo hay una versión visible"
    `);
    
    const hasVersionSelector = extractContent(hasVersionSelectorResponse);
    console.log(`   Respuesta: ${hasVersionSelector}`);
    
    // ESTRATEGIA 2: Extraer versiones visibles actualmente
    console.log(`\n🔍 Paso 2: Extrayendo información de la versión ACTUALMENTE VISIBLE...`);
    
    const currentVersionResponse = await page.extract(`
      Extrae SOLO la información del vehículo que está ACTUALMENTE VISIBLE en la página.
      NO inventes versiones que no ves.
      
      Busca:
      1. Nombre de la versión (ej: "BIGHORN", "LARAMIE", "R/T")
      2. Precio de lista (el precio más grande, principal)
      3. Bono todo medio de pago
      4. Bono financiamiento
      
      Retorna UN SOLO objeto JSON sin texto adicional:
      {
        "version": "nombre exacto que ves",
        "precioLista": "valor exacto con $ y formato",
        "bonoTodoMedioPago": "valor exacto o null",
        "bonoFinanciamiento": "valor exacto o null"
      }
      
      Si no ves claramente un valor, usa null.
    `);
    
    const currentVersionContent = extractContent(currentVersionResponse);
    console.log(`   Contenido extraído:`, currentVersionContent);
    
    // Parsear la versión actual
    let versions: VersionData[] = [];
    
    try {
      // Buscar el JSON en el contenido
      const jsonMatch = currentVersionContent.match(/\{[^{}]*\}/);
      
      if (jsonMatch) {
        console.log(`   JSON encontrado:`, jsonMatch[0]);
        const parsed = JSON.parse(jsonMatch[0]);
        
        versions.push({
          modelo: modelName,
          version: parsed.version || "Versión única",
          url: url,
          precioLista: parsed.precioLista || "No disponible",
          bonoTodoMedioPago: parsed.bonoTodoMedioPago || "No disponible",
          bonoFinanciamiento: parsed.bonoFinanciamiento || "No disponible"
        });
        
        console.log(`   ✅ Versión parseada correctamente:`, parsed.version);
      } else {
        console.error("   ⚠️ No se encontró JSON válido en la respuesta");
      }
    } catch (e) {
      console.error("   ⚠️ Error al parsear:", e);
      console.error("   Contenido problemático:", currentVersionContent);
    }
    
    // ESTRATEGIA 3: Si hay selector, intentar obtener otras versiones
    if (hasVersionSelector.toUpperCase().includes("SI")) {
      console.log(`\n🔍 Paso 3: Detectando TODAS las opciones disponibles en el selector...`);
      
      const allVersionNamesResponse = await page.extract(`
        Lista SOLO los NOMBRES de todas las versiones que aparecen en el selector/dropdown/botones.
        NO incluyas precios ni descripciones, SOLO los nombres.
        
        Retorna un array simple sin texto adicional:
        ["Versión 1", "Versión 2", "Versión 3"]
        
        Ejemplo para RAM RAMPAGE: ["BIGHORN", "LARAMIE", "R/T"]
      `);
      
      const allVersionNamesContent = extractContent(allVersionNamesResponse);
      console.log(`   Contenido de versiones:`, allVersionNamesContent);
      
      // Intentar hacer clic en cada versión y extraer datos
      try {
        const arrayMatch = allVersionNamesContent.match(/\[[^\[\]]*\]/);
        
        if (arrayMatch) {
          const versionNames = JSON.parse(arrayMatch[0]);
          console.log(`   Versiones encontradas:`, versionNames);
          
          // Empezar desde la segunda versión (la primera ya la tenemos)
          for (let i = 1; i < versionNames.length && i < 5; i++) { // Limitar a 5 versiones para evitar loops largos
            const versionName = versionNames[i];
            console.log(`\n   Intentando cambiar a versión: ${versionName}`);
            
            try {
              // Intentar hacer clic en la versión
              const acted = await page.act(`
                Haz clic en la opción "${versionName}" del selector de versiones.
                Si es un botón, haz clic en el botón.
                Si es un dropdown, primero ábrelo y luego selecciona la opción.
              `);
              
              console.log(`   Acción realizada:`, acted);
              await page.waitForTimeout(3000); // Esperar más tiempo para que cargue
              
              // Extraer datos de esta versión
              const versionDataResponse = await page.extract(`
                Extrae la información del vehículo que está AHORA visible después de hacer clic en "${versionName}":
                Retorna SOLO el JSON sin texto adicional:
                {
                  "version": "nombre de la versión",
                  "precioLista": "valor con $",
                  "bonoTodoMedioPago": "valor o null",
                  "bonoFinanciamiento": "valor o null"
                }
              `);
              
              const versionDataContent = extractContent(versionDataResponse);
              const versionJson = versionDataContent.match(/\{[^{}]*\}/);
              
              if (versionJson) {
                const parsed = JSON.parse(versionJson[0]);
                
                // Verificar que no sea la misma versión que ya tenemos
                const isDuplicate = versions.some(v => 
                  v.version === (parsed.version || versionName) &&
                  v.precioLista === (parsed.precioLista || "No disponible")
                );
                
                if (!isDuplicate) {
                  versions.push({
                    modelo: modelName,
                    version: parsed.version || versionName,
                    url: url,
                    precioLista: parsed.precioLista || "No disponible",
                    bonoTodoMedioPago: parsed.bonoTodoMedioPago || "No disponible",
                    bonoFinanciamiento: parsed.bonoFinanciamiento || "No disponible"
                  });
                  console.log(`   ✅ Nueva versión agregada:`, parsed.version || versionName);
                } else {
                  console.log(`   ⏭️ Versión duplicada, saltando...`);
                }
              }
            } catch (actError) {
              console.error(`   ⚠️ No se pudo cambiar a ${versionName}:`, actError);
            }
          }
        }
      } catch (e) {
        console.error("   ⚠️ Error procesando versiones:", e);
      }
    }
    
    console.log(`\n✅ Total de ${versions.length} versiones encontradas para ${modelName}`);
    versions.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.version}`);
      console.log(`      💰 ${v.precioLista}`);
      console.log(`      🎁 TMP: ${v.bonoTodoMedioPago}`);
      console.log(`      💳 Fin: ${v.bonoFinanciamiento}`);
    });
    
    return versions;
    
  } catch (error) {
    console.error(`❌ Error scrapeando ${modelName}:`, error);
    return [];
  }
}

async function scrapeAstara() {
  console.log("🚗 Iniciando scraping de Astara RAM (VERSIÓN CORREGIDA)...\n");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  try {
    // 1. Obtener lista de modelos
    console.log("📍 PASO 1: Obteniendo lista de modelos...");
    const url = "https://astararetail.cl/ram/";
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const extractionResponse = await page.extract(`
      Lista SOLO los modelos de vehículos RAM que aparecen en esta página principal.
      NO incluyas la marca RAM genérica.
      
      Para cada modelo específico (RAMPAGE, 700, 1500, etc.):
      - Nombre del modelo
      - URL completa
      
      Retorna SOLO el array JSON sin texto adicional:
      [{"model": "RAMPAGE", "url": "https://..."}, ...]
    `);
    
    const extractionContent = extractContent(extractionResponse);
    console.log(`\nContenido extraído:`, extractionContent);
    
    let models: any[] = [];
    
    try {
      const jsonMatch = extractionContent.match(/\[[^\[\]]*\{[^\[\]]+\}[^\[\]]*\]/);
      if (jsonMatch) {
        models = JSON.parse(jsonMatch[0]);
      } else {
        console.error("No se encontró un array JSON válido");
      }
      
      // Filtrar URL genérica
      models = models.filter(m => !m.url.endsWith('/ram/'));
      
      console.log(`\n✅ ${models.length} modelos encontrados:`);
      models.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.model} - ${m.url}`);
      });
      
    } catch (parseError) {
      console.error("❌ Error al parsear modelos:", parseError);
      console.error("Contenido problemático:", extractionContent);
      throw parseError;
    }
    
    // 2. Scrapear cada modelo
    console.log("\n\n📍 PASO 2: Scrapeando cada modelo...\n");
    const allVersions: VersionData[] = [];
    
    for (const model of models) {
      const versions = await scrapeModelVersions(page, model.url, model.model);
      allVersions.push(...versions);
      
      await page.waitForTimeout(2000);
    }
    
    // 3. Resumen final
    console.log("\n\n" + "=".repeat(100));
    console.log("📊 RESUMEN FINAL - VERSIONES REALES");
    console.log("=".repeat(100));
    
    const modelGroups = allVersions.reduce((acc, version) => {
      if (!acc[version.modelo]) {
        acc[version.modelo] = [];
      }
      acc[version.modelo].push(version);
      return acc;
    }, {} as Record<string, VersionData[]>);
    
    Object.entries(modelGroups).forEach(([modelo, versions]) => {
      console.log(`\n🚗 ${modelo.toUpperCase()} - ${versions.length} versiones`);
      console.log(`   URL: ${versions[0].url}`);
      console.log("   " + "-".repeat(96));
      
      versions.forEach((v, i) => {
        console.log(`\n   ${i + 1}. ${v.version}`);
        console.log(`      💰 Precio Lista: ${v.precioLista}`);
        console.log(`      🎁 Bono Todo Medio Pago: ${v.bonoTodoMedioPago}`);
        console.log(`      💳 Bono Financiamiento: ${v.bonoFinanciamiento}`);
      });
    });
    
    console.log("\n" + "=".repeat(100));
    console.log(`\n📈 TOTALES:`);
    console.log(`   • Modelos: ${Object.keys(modelGroups).length}`);
    console.log(`   • Versiones totales: ${allVersions.length}`);
    
    // Guardar resultados en JSON
    const fs = require('fs');
    const outputPath = './resultados_astara_ram.json';
    fs.writeFileSync(outputPath, JSON.stringify(allVersions, null, 2));
    console.log(`\n💾 Resultados guardados en: ${outputPath}`);
    
    return allVersions;
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await stagehand.close();
    console.log("\n✅ Scraping completado");
  }
}

// Ejecutar el scraper
scrapeAstara()
  .then(versions => {
    console.log(`\n🎉 Proceso finalizado: ${versions.length} versiones extraídas`);
  })
  .catch(console.error);