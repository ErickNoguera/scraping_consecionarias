// SCRAPER CALLEGARI - LÓGICA DE PRECIOS CORREGIDA
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

async function main() {
  console.log("🚀 Scraper Callegari - Lógica de precios CORREGIDA");
  console.log("🎯 Extrayendo primeros 10 autos de prueba\n");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  try {
    const url = 'https://callegari.cl/autos-nuevos/';
    console.log(`🌐 Cargando: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log("✅ Página cargada, esperando...");
    await page.waitForTimeout(5000);
    
    // Scroll para cargar contenido
    console.log("📜 Haciendo scroll...");
    
    await page.evaluate(async () => {
      for (let i = 0; i < 15; i++) {
        window.scrollBy(0, 400);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
    
    console.log("✅ Scroll completado");
    await page.waitForTimeout(3000);
    
    // Verificar cards
    const totalCards = await page.evaluate(() => {
      return document.querySelectorAll('div.auto-block').length;
    });
    
    console.log(`📦 Cards encontradas: ${totalCards}\n`);
    
    if (totalCards === 0) {
      await page.screenshot({ path: './debug_callegari.png', fullPage: true });
      console.log("📸 Screenshot: ./debug_callegari.png");
      throw new Error("No se encontraron autos");
    }
    
    const LIMIT = 231;
    console.log(`📊 Extrayendo datos de ${LIMIT} autos:\n`);
    
    const carsData = await page.evaluate((limit) => {
      const cards = Array.from(document.querySelectorAll('div.auto-block')).slice(0, limit);
      
      return cards.map((card, idx) => {
        try {
          const datosDiv = card.querySelector('div.datos');
          if (!datosDiv) return null;
          
          // Marca
          const marcaSpan = datosDiv.querySelector('span.marca');
          const marca = marcaSpan?.textContent?.trim() || '';
          
          // Modelo
          const modeloH3 = datosDiv.querySelector('h3');
          const modelo = modeloH3?.textContent?.trim() || '';
          
          // URL
          const link = datosDiv.querySelector('a[href*="/nuevos/"]');
          const href = link?.getAttribute('href') || '';
          const url = href.startsWith('http') ? href : `https://callegari.cl${href}`;
          
          // NUEVA LÓGICA DE PRECIOS
          // 1. Precio "Desde" (rojo) = PRECIO LISTA para nosotros
          const precioDesdeSpan = datosDiv.querySelector('span.precio-desde');
          const precioDesdeText = precioDesdeSpan?.textContent || '';
          const precioLista = precioDesdeText.replace(/[^\d]/g, '') || null;
          
          // 2. Precio tachado = PRECIO TODO MEDIO PAGO
          const precioTachadoDel = datosDiv.querySelector('div.subprecios del');
          const precioTachadoText = precioTachadoDel?.textContent || '';
          const precioTodoMedioPago = precioTachadoText.replace(/[^\d]/g, '') || null;
          
          // 3. Bonos
          let bonoMarca = null;
          let bonoFinanciamiento = null;
          
          const subprecios = datosDiv.querySelector('div.subprecios');
          if (subprecios) {
            const allSpans = subprecios.querySelectorAll('span');
            
            allSpans.forEach(span => {
              const text = span.textContent || '';
              
              if (text.includes('Bono Marca:')) {
                const numbers = text.replace(/[^\d]/g, '');
                if (numbers) bonoMarca = numbers;
              } 
              else if (text.includes('Bono financiamiento:')) {
                const numbers = text.replace(/[^\d]/g, '');
                if (numbers) bonoFinanciamiento = numbers;
              }
            });
          }
          
          return {
            index: idx + 1,
            marca,
            modelo,
            precioLista,
            precioTodoMedioPago,
            bonoMarca,
            bonoFinanciamiento,
            url
          };
          
        } catch (e) {
          console.error(`Error en card ${idx + 1}:`, e);
          return null;
        }
      }).filter(car => car !== null);
      
    }, LIMIT);
    
    console.log(`✅ Datos extraídos: ${carsData.length} autos\n`);
    
    // Procesar y validar
    const allCars: CarData[] = [];
    let descartados = 0;
    
    for (const data of carsData) {
      if (!data || !data.modelo || !data.precioLista) {
        console.log(`   ${data?.index || '?'}. ⚠️ Datos incompletos`);
        descartados++;
        continue;
      }
      
      // CALCULAR PRECIO CON FINANCIAMIENTO
      // = Precio Lista + Bono Financiamiento
      let precioConFinanciamiento: string | null = null;
      if (data.precioLista && data.bonoFinanciamiento) {
        const lista = parseInt(data.precioLista);
        const bonoFin = parseInt(data.bonoFinanciamiento);
        precioConFinanciamiento = (lista + bonoFin).toString();
      }
      
      const carData: CarData = {
        marca: data.marca.toUpperCase(),
        modelo: data.modelo.toUpperCase(),
        version: null,
        precio_lista: data.precioLista,
        bono_marca: data.bonoMarca,
        bono_financiamiento: data.bonoFinanciamiento,
        precio_todo_medio_pago: data.precioTodoMedioPago,
        precio_con_financiamiento: precioConFinanciamiento,
        url: data.url,
        dealer: "Callegari"
      };
      
      // Mostrar info
      console.log(`   ${data.index}. ${carData.marca} ${carData.modelo}`);
      
      if (carData.precio_lista) {
        const precio = parseInt(carData.precio_lista);
        console.log(`      💰 Precio Lista (Desde): $${precio.toLocaleString('es-CL')}`);
      }
      
      if (carData.precio_todo_medio_pago) {
        const precio = parseInt(carData.precio_todo_medio_pago);
        console.log(`      🔴 Todo Medio Pago (tachado): $${precio.toLocaleString('es-CL')}`);
      }
      
      if (carData.bono_marca) {
        const bono = parseInt(carData.bono_marca);
        console.log(`      🎁 Bono Marca: $${bono.toLocaleString('es-CL')}`);
      }
      
      if (carData.bono_financiamiento) {
        const bono = parseInt(carData.bono_financiamiento);
        console.log(`      🏦 Bono Financ: $${bono.toLocaleString('es-CL')}`);
      }
      
      if (precioConFinanciamiento) {
        const precio = parseInt(precioConFinanciamiento);
        console.log(`      💵 Con Financ: $${precio.toLocaleString('es-CL')}`);
      }
      
      // Validar
      if (isValidEntry(carData)) {
        allCars.push(carData);
        console.log(`      ✅ VÁLIDA\n`);
      } else {
        descartados++;
        console.log(`      ❌ DESCARTADA (validación)\n`);
      }
    }
    
    // Resumen
    console.log(`${"=".repeat(70)}`);
    console.log("📊 RESUMEN FINAL");
    console.log("=".repeat(70));
    console.log(`Total procesados: ${carsData.length}`);
    console.log(`Válidos: ${allCars.length}`);
    console.log(`Descartados: ${descartados}`);
    
    if (allCars.length > 0) {
      const tasa = (allCars.length / carsData.length * 100).toFixed(1);
      console.log(`Tasa éxito: ${tasa}%`);
      
      // Guardar como callegari.csv
      const normalized = allCars.map(r => normalize(r, "Callegari"));
      writeCSV("callegari.csv", normalized);
      appendToMerged(normalized);
      
      console.log("\n✅ Archivo guardado: ./output/callegari.csv");
      
      // Mostrar ejemplo de un auto (para verificar)
      if (allCars.length > 0) {
        const ejemplo = allCars[0];
        console.log("\n📋 Ejemplo de datos guardados (primer auto):");
        console.log(`   Marca: ${ejemplo.marca}`);
        console.log(`   Modelo: ${ejemplo.modelo}`);
        console.log(`   Precio Lista: ${ejemplo.precio_lista}`);
        console.log(`   Todo Medio Pago: ${ejemplo.precio_todo_medio_pago}`);
        console.log(`   Bono Marca: ${ejemplo.bono_marca}`);
        console.log(`   Bono Financ: ${ejemplo.bono_financiamiento}`);
        console.log(`   Con Financ: ${ejemplo.precio_con_financiamiento}`);
      }
    } else {
      console.log("\n⚠️ No hay datos válidos para guardar");
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error}`);
    
    try {
      await page.screenshot({ path: './error_callegari.png' });
      console.log("📸 Screenshot de error: ./error_callegari.png");
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