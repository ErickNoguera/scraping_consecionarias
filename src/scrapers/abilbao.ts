// SCRAPER ABILBAO - Suzuki y Mazda (PRUEBA)
import { createStagehand } from "../utils/stagehandConfigV2";
import { writeCSV, appendToMerged } from "../utils/writer";
import { normalize } from "../utils/normalizer";

interface CarData {
  marca: string;
  modelo: string;
  version: string | null;
  precio_lista: string | null;
  bono_marca: string | null;
  bono_financiamiento: string | null;
  precio_todo_medio_pago: string | null;
  precio_con_financiamiento: string | null;
  url: string;
  dealer: string;
}

function isValidEntry(car: CarData): boolean {
  const precioLista = parseInt(car.precio_lista || '0', 10);
  const bonoMarca = parseInt(car.bono_marca || '0', 10);
  const bonoFin = parseInt(car.bono_financiamiento || '0', 10);

  if (!precioLista || precioLista <= 0) return false;
  if (bonoMarca > precioLista * 0.5) return false;
  if (bonoFin > precioLista * 0.5) return false;
  
  return true;
}

async function scrapeModeloVersiones(page: any, marca: string, modelo: string, modeloUrl: string): Promise<CarData[]> {
  console.log(`\n   📄 Entrando a: ${modelo}`);
  console.log(`   🌐 URL: ${modeloUrl}`);
  
  try {
    await page.goto(modeloUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await page.waitForTimeout(3000);
    
    // Scroll para cargar versiones
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, 500);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
    
    await page.waitForTimeout(2000);
    
    // Verificar si hay versiones (cards)
    const totalCards = await page.evaluate(() => {
      return document.querySelectorAll('div.item-card').length;
    });
    
    console.log(`   📦 Versiones encontradas: ${totalCards}`);
    
    if (totalCards === 0) {
      console.log(`   ⚠️ No se encontraron versiones para ${modelo}`);
      return [];
    }
    
    // Extraer datos de versiones
    const versionesData = await page.evaluate(({ marcaParam, modeloParam }: { marcaParam: string, modeloParam: string }) => {
      const cards = Array.from(document.querySelectorAll('div.item-card'));
      
      return cards.map((card, idx) => {
        try {
          // Marca (puede estar en título o usar parámetro)
          const marcaImg = card.querySelector('.titulo--marca img');
          const marca = marcaImg?.getAttribute('alt') || marcaParam;
          
          // Modelo
          const modeloDiv = card.querySelector('.modelo--titulo');
          const modelo = modeloDiv?.textContent?.trim() || modeloParam;
          
          // Versión
          const versionDiv = card.querySelector('.modelo--caracteristica');
          const version = versionDiv?.textContent?.trim() || null;
          
          // URL del modelo
          const verModeloLink = card.querySelector('a[href*="/ficha/"]');
          const href = verModeloLink?.getAttribute('href') || '';
          const url = href.startsWith('http') ? href : `https://www.abilbao.cl${href}`;
          
          // PRECIOS
          // 1. Precio Normal (tachado) = PRECIO LISTA
          const precioNormalSpan = card.querySelector('.price-normal .price-value');
          const precioLista = precioNormalSpan?.textContent?.replace(/[^\d]/g, '') || null;
          
          // 2. Main Price (con asterisco) = PRECIO CON FINANCIAMIENTO
          const mainPriceSpan = card.querySelector('.main-price .price-value');
          const precioConFinanciamiento = mainPriceSpan?.textContent?.replace(/[^\d]/g, '') || null;
          
          // 3. Bonos - Estrategia mejorada con múltiples intentos
          let bonoMarca: string | null = null;
          let bonoFinanciamiento: string | null = null;
          
          const bonusDiv = card.querySelector('.bonus-price');
          if (bonusDiv) {
            // INTENTO 1: Buscar divs con clase "t12 bonus"
            const bonusDivs = bonusDiv.querySelectorAll('div.t12.bonus');
            
            console.log(`[DEBUG] Found ${bonusDivs.length} bonus divs`);
            
            bonusDivs.forEach((bonusItem: Element, idx: number) => {
              const fullText = bonusItem.textContent || '';
              const priceSpan = bonusItem.querySelector('span.price-value');
              
              console.log(`[DEBUG] Bonus ${idx}: text="${fullText.substring(0, 50)}", has span=${!!priceSpan}`);
              
              if (priceSpan && priceSpan.textContent) {
                const priceText = priceSpan.textContent.trim();
                const cleanNumber = priceText.replace(/[^\d]/g, '');
                
                console.log(`[DEBUG] Bonus ${idx}: priceText="${priceText}", clean="${cleanNumber}"`);
                
                if (fullText.toLowerCase().includes('marca') && cleanNumber && cleanNumber !== '0') {
                  bonoMarca = cleanNumber;
                  console.log(`[DEBUG] Set bonoMarca = ${bonoMarca}`);
                } else if (fullText.toLowerCase().includes('financiamiento') && cleanNumber && cleanNumber !== '0') {
                  bonoFinanciamiento = cleanNumber;
                  console.log(`[DEBUG] Set bonoFinanciamiento = ${bonoFinanciamiento}`);
                }
              }
            });
            
            // INTENTO 2: Si no encontró bonos, buscar sin el punto entre clases
            if (!bonoMarca && !bonoFinanciamiento) {
              console.log('[DEBUG] Trying alternative selector...');
              const allDivsInBonus = bonusDiv.querySelectorAll('div');
              
              allDivsInBonus.forEach((div: Element) => {
                const className = div.className || '';
                if (className.includes('t12') && className.includes('bonus')) {
                  const fullText = div.textContent || '';
                  const priceSpan = div.querySelector('span.price-value');
                  
                  if (priceSpan && priceSpan.textContent) {
                    const priceText = priceSpan.textContent.trim();
                    const cleanNumber = priceText.replace(/[^\d]/g, '');
                    
                    if (fullText.toLowerCase().includes('marca') && cleanNumber && cleanNumber !== '0') {
                      bonoMarca = cleanNumber;
                    } else if (fullText.toLowerCase().includes('financiamiento') && cleanNumber && cleanNumber !== '0') {
                      bonoFinanciamiento = cleanNumber;
                    }
                  }
                }
              });
            }
          }
          
          return {
            index: idx + 1,
            marca,
            modelo,
            version,
            precioLista,
            bonoMarca,
            bonoFinanciamiento,
            precioConFinanciamiento,
            url
          };
          
        } catch (e) {
          console.error(`Error en version ${idx + 1}:`, e);
          return null;
        }
      }).filter(v => v !== null);
      
    }, { marcaParam: marca, modeloParam: modelo });
    
    // Procesar versiones
    const validVersions: CarData[] = [];
    
    for (const data of versionesData) {
      if (!data || !data.modelo || !data.precioLista) {
        console.log(`      ${data?.index || '?'}. ⚠️ Datos incompletos`);
        continue;
      }
      
      // CALCULAR PRECIO TODO MEDIO PAGO
      // = Precio Lista - Bono Marca
      let precioTodoMedioPago: string | null = null;
      if (data.precioLista && data.bonoMarca) {
        const lista = parseInt(data.precioLista);
        const bono = parseInt(data.bonoMarca);
        precioTodoMedioPago = (lista - bono).toString();
      }
      
      const carData: CarData = {
        marca: data.marca.toUpperCase(),
        modelo: data.modelo.toUpperCase(),
        version: data.version,
        precio_lista: data.precioLista,
        bono_marca: data.bonoMarca && data.bonoMarca !== '0' ? data.bonoMarca : null,
        bono_financiamiento: data.bonoFinanciamiento && data.bonoFinanciamiento !== '0' ? data.bonoFinanciamiento : null,
        precio_todo_medio_pago: precioTodoMedioPago,
        precio_con_financiamiento: data.precioConFinanciamiento,
        url: data.url,
        dealer: "Abilbao"
      };
      
      // Mostrar info
      console.log(`      ${data.index}. ${carData.modelo} ${carData.version || ''}`);
      
      if (carData.precio_lista) {
        const precio = parseInt(carData.precio_lista);
        console.log(`         💰 Precio Lista: $${precio.toLocaleString('es-CL')}`);
      }
      
      if (carData.precio_todo_medio_pago) {
        const precio = parseInt(carData.precio_todo_medio_pago);
        console.log(`         🔴 Todo Medio Pago: $${precio.toLocaleString('es-CL')}`);
      }
      
      if (carData.bono_marca) {
        const bono = parseInt(carData.bono_marca);
        console.log(`         🎁 Bono Marca: $${bono.toLocaleString('es-CL')}`);
      }
      
      if (carData.bono_financiamiento) {
        const bono = parseInt(carData.bono_financiamiento);
        console.log(`         🏦 Bono Financ: $${bono.toLocaleString('es-CL')}`);
      }
      
      if (carData.precio_con_financiamiento) {
        const precio = parseInt(carData.precio_con_financiamiento);
        console.log(`         💵 Con Financ: $${precio.toLocaleString('es-CL')}`);
      }
      
      // Validar
      if (isValidEntry(carData)) {
        validVersions.push(carData);
        console.log(`         ✅ VÁLIDA`);
      } else {
        console.log(`         ❌ DESCARTADA (validación)`);
      }
    }
    
    return validVersions;
    
  } catch (error) {
    console.error(`   ❌ Error al procesar ${modelo}:`, error);
    return [];
  }
}

async function scrapeMarca(page: any, marca: string, marcaUrl: string): Promise<CarData[]> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🚗 EXTRAYENDO: ${marca.toUpperCase()}`);
  console.log(`🌐 URL: ${marcaUrl}`);
  console.log("=".repeat(70));
  
  try {
    await page.goto(marcaUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log("✅ Página de marca cargada, esperando...");
    await page.waitForTimeout(5000);
    
    // Scroll para cargar modelos
    console.log("📜 Haciendo scroll...");
    await page.evaluate(async () => {
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 600);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 1500));
    });
    
    await page.waitForTimeout(3000);
    
    // Extraer modelos - buscar todos los links que van a /ficha/[marca]/[modelo]
    const modelos = await page.evaluate(({ marcaParam }: { marcaParam: string }) => {
      // Buscar todos los links que contengan /ficha/ y la marca
      const allLinks = Array.from(document.querySelectorAll('a[href*="/ficha/"]'));
      
      const modelosMap = new Map();
      
      allLinks.forEach((link) => {
        try {
          const href = link.getAttribute('href') || '';
          
          // Filtrar solo los links de modelos específicos de esta marca
          // Formato esperado: /ficha/suzuki/jimny/ o /ficha/mazda/cx-3/
          const regex = new RegExp(`/ficha/[^/]+/[^/]+/?$`);
          
          if (!regex.test(href)) return;
          
          const url = href.startsWith('http') ? href : `https://www.abilbao.cl${href}`;
          
          // Evitar duplicados
          if (modelosMap.has(url)) return;
          
          // Extraer nombre del modelo desde la URL
          const urlParts = url.split('/').filter(p => p);
          const modeloSlug = urlParts[urlParts.length - 1] || '';
          
          // Intentar obtener el nombre visible del modelo
          let nombre = link.textContent?.trim() || '';
          
          // Si no hay texto visible, usar el slug formateado
          if (!nombre || nombre.length < 2) {
            nombre = modeloSlug.split('-').map(w => 
              w.charAt(0).toUpperCase() + w.slice(1)
            ).join(' ');
          }
          
          modelosMap.set(url, {
            nombre: nombre,
            url: url,
            slug: modeloSlug
          });
          
        } catch (e) {
          console.error('Error procesando link:', e);
        }
      });
      
      return Array.from(modelosMap.values()).map((m, idx) => ({
        index: idx + 1,
        nombre: m.nombre,
        url: m.url
      }));
      
    }, { marcaParam: marca });
    
    console.log(`📦 Modelos encontrados: ${modelos.length}\n`);
    
    if (modelos.length === 0) {
      console.log("⚠️ No se encontraron modelos para esta marca");
      
      // Debug: tomar screenshot
      try {
        const screenshotPath = `./debug_${marca.toLowerCase()}_modelos.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot de debug: ${screenshotPath}`);
      } catch (e) {
        // ignore
      }
      
      return [];
    }
    
    // Mostrar modelos
    modelos.forEach((m: any) => {
      console.log(`   ${m.index}. ${m.nombre}`);
    });
    
    const allVersions: CarData[] = [];
    
    // Procesar cada modelo
    for (const modelo of modelos) {
      await page.waitForTimeout(2000);
      
      const versiones = await scrapeModeloVersiones(
        page, 
        marca, 
        modelo.nombre, 
        modelo.url
      );
      
      allVersions.push(...versiones);
    }
    
    // Resumen de marca
    console.log(`\n📊 Resumen ${marca.toUpperCase()}:`);
    console.log(`   Modelos procesados: ${modelos.length}`);
    console.log(`   Versiones válidas: ${allVersions.length}`);
    
    return allVersions;
    
  } catch (error) {
    console.error(`❌ Error al procesar marca ${marca}:`, error);
    return [];
  }
}

async function main() {
  console.log("🚀 Scraper ABILBAO - Suzuki y Mazda (PRUEBA)");
  console.log("🎯 Extrayendo precios de primeras 2 marcas\n");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  try {
    // Marcas a extraer (SOLO PRIMERAS 2 PARA PRUEBA)
    const marcas = [
      { nombre: "Suzuki", url: "https://www.abilbao.cl/ficha/modelos-suzuki/" },
      { nombre: "Mazda", url: "https://www.abilbao.cl/ficha/modelos-mazda/" }
    ];
    
    const allCars: CarData[] = [];
    
    // Extraer cada marca
    for (const marca of marcas) {
      const cars = await scrapeMarca(page, marca.nombre, marca.url);
      allCars.push(...cars);
      
      // Esperar entre marcas
      if (marca !== marcas[marcas.length - 1]) {
        console.log("\n⏳ Esperando antes de la siguiente marca...\n");
        await page.waitForTimeout(4000);
      }
    }
    
    // Resumen final
    console.log(`\n${"=".repeat(70)}`);
    console.log("📊 RESUMEN FINAL");
    console.log("=".repeat(70));
    console.log(`Total autos válidos: ${allCars.length}`);
    
    // Contar por marca
    const suzukiCount = allCars.filter(c => c.marca === "SUZUKI").length;
    const mazdaCount = allCars.filter(c => c.marca === "MAZDA").length;
    
    console.log(`   Suzuki: ${suzukiCount} autos`);
    console.log(`   Mazda: ${mazdaCount} autos`);
    
    if (allCars.length > 0) {
      // Guardar como abilbao.csv
      const normalized = allCars.map(r => normalize(r, "Abilbao"));
      writeCSV("abilbao.csv", normalized);
      appendToMerged(normalized);
      
      console.log("\n✅ Archivo guardado: ./output/abilbao.csv");
      console.log("✅ Datos agregados a: ./output/merged.csv");
      
      // Mostrar ejemplos
      const ejemploSuzuki = allCars.find(c => c.marca === "SUZUKI");
      const ejemploMazda = allCars.find(c => c.marca === "MAZDA");
      
      if (ejemploSuzuki) {
        console.log("\n📋 Ejemplo Suzuki:");
        console.log(`   Modelo: ${ejemploSuzuki.modelo}`);
        console.log(`   Versión: ${ejemploSuzuki.version}`);
        console.log(`   Precio Lista: $${parseInt(ejemploSuzuki.precio_lista || '0').toLocaleString('es-CL')}`);
        console.log(`   Todo Medio Pago: ${ejemploSuzuki.precio_todo_medio_pago ? '$' + parseInt(ejemploSuzuki.precio_todo_medio_pago).toLocaleString('es-CL') : 'N/A'}`);
        console.log(`   Con Financ: ${ejemploSuzuki.precio_con_financiamiento ? '$' + parseInt(ejemploSuzuki.precio_con_financiamiento).toLocaleString('es-CL') : 'N/A'}`);
      }
      
      if (ejemploMazda) {
        console.log("\n📋 Ejemplo Mazda:");
        console.log(`   Modelo: ${ejemploMazda.modelo}`);
        console.log(`   Versión: ${ejemploMazda.version}`);
        console.log(`   Precio Lista: $${parseInt(ejemploMazda.precio_lista || '0').toLocaleString('es-CL')}`);
        console.log(`   Todo Medio Pago: ${ejemploMazda.precio_todo_medio_pago ? '$' + parseInt(ejemploMazda.precio_todo_medio_pago).toLocaleString('es-CL') : 'N/A'}`);
        console.log(`   Con Financ: ${ejemploMazda.precio_con_financiamiento ? '$' + parseInt(ejemploMazda.precio_con_financiamiento).toLocaleString('es-CL') : 'N/A'}`);
      }
    } else {
      console.log("\n⚠️ No hay datos válidos para guardar");
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error}`);
    
    try {
      await page.screenshot({ path: './error_abilbao.png' });
      console.log("📸 Screenshot de error: ./error_abilbao.png");
    } catch (e) {
      // ignore
    }
    
    throw error;
    
  } finally {
    await stagehand.close();
    console.log("\n🏁 Finalizado");
  }
}

// EJECUTAR
main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Fatal:", err.message);
    process.exit(1);
  });