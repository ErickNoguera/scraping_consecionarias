// SCRAPER CIDEF - Dongfeng y Foton
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

async function scrapeMarca(page: any, marca: string, url: string): Promise<CarData[]> {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🚗 EXTRAYENDO: ${marca.toUpperCase()}`);
  console.log(`🌐 URL: ${url}`);
  console.log("=".repeat(70));
  
  await page.goto(url, { 
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  console.log("✅ Página cargada, esperando...");
  await page.waitForTimeout(5000);
  
  // Scroll para cargar contenido
  console.log("📜 Haciendo scroll...");
  await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) {
      window.scrollBy(0, 500);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    window.scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  console.log("✅ Scroll completado");
  await page.waitForTimeout(3000);
  
  // Verificar cards
  const totalCards = await page.evaluate(() => {
    return document.querySelectorAll('div.card.card-auto').length;
  });
  
  console.log(`📦 Cards encontradas: ${totalCards}\n`);
  
  if (totalCards === 0) {
    console.log("⚠️ No se encontraron autos para esta marca");
    return [];
  }
  
  // Extraer datos
  const carsData = await page.evaluate((marcaParam: string) => {
    const cards = Array.from(document.querySelectorAll('div.card.card-auto'));
    
    return cards.map((card, idx) => {
      try {
        const infoDiv = card.querySelector('div.info-auto-card');
        if (!infoDiv) return null;
        
        // Marca
        const marcaSmall = infoDiv.querySelector('div.title-marca small');
        const marca = marcaSmall?.textContent?.trim() || marcaParam;
        
        // Modelo (incluye versión)
        const modeloP = infoDiv.querySelector('div.card-title p');
        const modelo = modeloP?.textContent?.trim() || '';
        
        // URL
        const link = infoDiv.querySelector('a[href*="/modelo/"]');
        const href = link?.getAttribute('href') || '';
        const url = href.startsWith('http') ? href : `https://cidef.cl${href}`;
        
        // PRECIOS
        // 1. Precio Lista (price-one)
        const priceOne = infoDiv.querySelector('div.card-price.price-one h3');
        const precioListaText = priceOne?.textContent || '';
        const precioLista = precioListaText.replace(/[^\d]/g, '') || null;
        
        // 2. Bono Marca (price-two)
        const priceTwo = infoDiv.querySelector('div.card-price.price-two h3');
        const bonoMarcaText = priceTwo?.textContent || '';
        const bonoMarca = bonoMarcaText.replace(/[^\d]/g, '') || null;
        
        // 3. Bono Financiamiento (price-three)
        const priceThree = infoDiv.querySelector('div.card-price.price-three h3');
        const bonoFinText = priceThree?.textContent || '';
        const bonoFinanciamiento = bonoFinText.replace(/[^\d]/g, '') || null;
        
        // 4. Precio con Financiamiento (price-four)
        const priceFour = infoDiv.querySelector('div.card-price.price-four h3');
        const precioConFinText = priceFour?.textContent || '';
        const precioConFinanciamiento = precioConFinText.replace(/[^\d]/g, '') || null;
        
        return {
          index: idx + 1,
          marca,
          modelo,
          precioLista,
          bonoMarca,
          bonoFinanciamiento,
          precioConFinanciamiento,
          url
        };
        
      } catch (e) {
        console.error(`Error en card ${idx + 1}:`, e);
        return null;
      }
    }).filter(car => car !== null);
    
  }, marca);
  
  console.log(`✅ Datos extraídos: ${carsData.length} autos\n`);
  
  // Procesar y validar
  const validCars: CarData[] = [];
  let descartados = 0;
  
  for (const data of carsData) {
    if (!data || !data.modelo || !data.precioLista) {
      console.log(`   ${data?.index || '?'}. ⚠️ Datos incompletos`);
      descartados++;
      continue;
    }
    
    const carData: CarData = {
      marca: data.marca.toUpperCase(),
      modelo: data.modelo.toUpperCase(),
      version: null, // Versión incluida en modelo
      precio_lista: data.precioLista,
      bono_marca: data.bonoMarca && data.bonoMarca !== '0' ? data.bonoMarca : null,
      bono_financiamiento: data.bonoFinanciamiento && data.bonoFinanciamiento !== '0' ? data.bonoFinanciamiento : null,
      precio_todo_medio_pago: null, // No aplica para CIDEF
      precio_con_financiamiento: data.precioConFinanciamiento,
      url: data.url,
      dealer: "CIDEF"
    };
    
    // Mostrar info
    console.log(`   ${data.index}. ${carData.marca} ${carData.modelo}`);
    
    if (carData.precio_lista) {
      const precio = parseInt(carData.precio_lista);
      console.log(`      💰 Precio Lista: $${precio.toLocaleString('es-CL')}`);
    }
    
    if (carData.bono_marca) {
      const bono = parseInt(carData.bono_marca);
      console.log(`      🎁 Bono Marca: $${bono.toLocaleString('es-CL')}`);
    }
    
    if (carData.bono_financiamiento) {
      const bono = parseInt(carData.bono_financiamiento);
      console.log(`      🏦 Bono Financ: $${bono.toLocaleString('es-CL')}`);
    }
    
    if (carData.precio_con_financiamiento) {
      const precio = parseInt(carData.precio_con_financiamiento);
      console.log(`      💵 Con Financ: $${precio.toLocaleString('es-CL')}`);
    }
    
    // Validar
    if (isValidEntry(carData)) {
      validCars.push(carData);
      console.log(`      ✅ VÁLIDA\n`);
    } else {
      descartados++;
      console.log(`      ❌ DESCARTADA (validación)\n`);
    }
  }
  
  // Resumen de marca
  console.log(`\n📊 Resumen ${marca.toUpperCase()}:`);
  console.log(`   Total procesados: ${carsData.length}`);
  console.log(`   Válidos: ${validCars.length}`);
  console.log(`   Descartados: ${descartados}`);
  
  return validCars;
}

async function main() {
  console.log("🚀 Scraper CIDEF - Dongfeng y Foton");
  console.log("🎯 Extrayendo precios de ambas marcas\n");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  try {
    // Marcas a extraer
    const marcas = [
      { nombre: "Dongfeng", url: "https://cidef.cl/marca/dongfeng/" },
      { nombre: "Foton", url: "https://cidef.cl/marca/foton/" }
    ];
    
    const allCars: CarData[] = [];
    
    // Extraer cada marca
    for (const marca of marcas) {
      const cars = await scrapeMarca(page, marca.nombre, marca.url);
      allCars.push(...cars);
      
      // Esperar entre marcas
      if (marca !== marcas[marcas.length - 1]) {
        console.log("\n⏳ Esperando antes de la siguiente marca...\n");
        await page.waitForTimeout(3000);
      }
    }
    
    // Resumen final
    console.log(`\n${"=".repeat(70)}`);
    console.log("📊 RESUMEN FINAL");
    console.log("=".repeat(70));
    console.log(`Total autos válidos: ${allCars.length}`);
    
    // Contar por marca
    const dongfengCount = allCars.filter(c => c.marca === "DONGFENG").length;
    const fotonCount = allCars.filter(c => c.marca === "FOTON").length;
    
    console.log(`   Dongfeng: ${dongfengCount} autos`);
    console.log(`   Foton: ${fotonCount} autos`);
    
    if (allCars.length > 0) {
      // Guardar como cidef.csv
      const normalized = allCars.map(r => normalize(r, "CIDEF"));
      writeCSV("cidef.csv", normalized);
      appendToMerged(normalized);
      
      console.log("\n✅ Archivo guardado: ./output/cidef.csv");
      console.log("✅ Datos agregados a: ./output/merged.csv");
      
      // Mostrar ejemplo
      const ejemploDongfeng = allCars.find(c => c.marca === "DONGFENG");
      const ejemploFoton = allCars.find(c => c.marca === "FOTON");
      
      if (ejemploDongfeng) {
        console.log("\n📋 Ejemplo Dongfeng:");
        console.log(`   Modelo: ${ejemploDongfeng.modelo}`);
        console.log(`   Precio Lista: $${parseInt(ejemploDongfeng.precio_lista || '0').toLocaleString('es-CL')}`);
        console.log(`   Bono Marca: ${ejemploDongfeng.bono_marca ? '$' + parseInt(ejemploDongfeng.bono_marca).toLocaleString('es-CL') : 'N/A'}`);
        console.log(`   Con Financ: ${ejemploDongfeng.precio_con_financiamiento ? '$' + parseInt(ejemploDongfeng.precio_con_financiamiento).toLocaleString('es-CL') : 'N/A'}`);
      }
      
      if (ejemploFoton) {
        console.log("\n📋 Ejemplo Foton:");
        console.log(`   Modelo: ${ejemploFoton.modelo}`);
        console.log(`   Precio Lista: $${parseInt(ejemploFoton.precio_lista || '0').toLocaleString('es-CL')}`);
        console.log(`   Bono Marca: ${ejemploFoton.bono_marca ? '$' + parseInt(ejemploFoton.bono_marca).toLocaleString('es-CL') : 'N/A'}`);
        console.log(`   Con Financ: ${ejemploFoton.precio_con_financiamiento ? '$' + parseInt(ejemploFoton.precio_con_financiamiento).toLocaleString('es-CL') : 'N/A'}`);
      }
    } else {
      console.log("\n⚠️ No hay datos válidos para guardar");
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error}`);
    
    try {
      await page.screenshot({ path: './error_cidef.png' });
      console.log("📸 Screenshot de error: ./error_cidef.png");
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