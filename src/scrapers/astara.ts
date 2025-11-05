import { createStagehand } from "../utils/stagehandConfig";
import { writeCSV, appendToMerged } from "../utils/writer";
import { normalize } from "../utils/normalizer";

const BRANDS = ['gac', 'byd'];  // Solo 2 marcas para prueba - luego cambia a todas

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
  const precioMedio = parseInt(car.precio_todo_medio_pago || '0', 10);
  const precioFinanc = parseInt(car.precio_con_financiamiento || '0', 10);

  // Validaciones básicas
  if (!lista || lista <= 0) {
    console.warn(`   ⚠️ Descartado: precio_lista inválido (${lista})`);
    return false;
  }

  // Validar bonos no superen 30% del precio lista
  if (bonoMedio > lista * 0.3) {
    console.warn(`   ⚠️ Descartado: bono_todo_medio_pago (${bonoMedio}) supera 30% de precio_lista (${lista})`);
    return false;
  }

  if (bonoFin > lista * 0.3) {
    console.warn(`   ⚠️ Descartado: bono_financiamiento (${bonoFin}) supera 30% de precio_lista (${lista})`);
    return false;
  }

  // Validar coherencia de precios finales
  if (precioMedio && precioMedio > lista) {
    console.warn(`   ⚠️ Descartado: precio_todo_medio_pago (${precioMedio}) mayor que precio_lista (${lista})`);
    return false;
  }

  if (precioFinanc && precioFinanc > lista) {
    console.warn(`   ⚠️ Descartado: precio_con_financiamiento (${precioFinanc}) mayor que precio_lista (${lista})`);
    return false;
  }

  return true;
}

function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]/g, ' ')
    .trim();
}

function extractNumberFromText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d]/g, '');
  return cleaned || null;
}

function calculateBono(precioLista: string | null, precioFinal: string | null): string | null {
  if (!precioLista || !precioFinal) return null;
  const lista = parseInt(precioLista, 10);
  const final = parseInt(precioFinal, 10);
  if (lista <= final) return null;
  return (lista - final).toString();
}

export async function scrapeAstara() {
  console.log("🚀 Iniciando scraper de Astara (versión híbrida mejorada)...");
  
  const stagehand = await createStagehand();
  const page = stagehand.page;
  
  let allCars: CarData[] = [];
  let totalDescartados = 0;
  
  for (const brand of BRANDS) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`🏷️ Procesando marca: ${brand.toUpperCase()}`);
    console.log("=".repeat(80));
    
    try {
      const brandUrl = `https://astararetail.cl/${brand}/`;
      console.log(`📍 Navegando a: ${brandUrl}`);
      await page.goto(brandUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000); // Más tiempo para carga completa
      
      // Extraer URLs de modelos - método mejorado
      const modelUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const urls = new Set<string>();
        
        links.forEach(link => {
          const href = (link as HTMLAnchorElement).href;
          
          // Solo URLs del dominio astararetail.cl
          if (!href.includes('astararetail.cl')) return;
          
          // Extraer la parte después del dominio
          const match = href.match(/astararetail\.cl\/([^\/\?#]+)\/?$/);
          if (!match) return;
          
          const slug = match[1];
          
          // Filtrar páginas no deseadas
          const excludeTerms = [
            'seminuevos', 'liquidacion', 'ofertas', 'servicio',
            'flotas', 'sucursales', 'politicas', 'cookies',
            'buscador', 'contacto', 'nosotros', 'blog'
          ];
          
          if (excludeTerms.some(term => slug.includes(term))) return;
          
          // Incluir si parece un modelo (tiene guión o es conocido)
          const knownModels = ['500e', '600e', 'pulse', 'fastback', 'ducato', 'outlander-sport'];
          if (slug.includes('-') || knownModels.some(model => slug.includes(model))) {
            urls.add(href.replace(/\/$/, ''));
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
          await page.waitForTimeout(3000);
          
          // PASO 1: Intentar extracción directa por selectores DOM
          console.log(`   🔍 Intentando extracción por selectores DOM...`);
          
          let versions = await page.evaluate((brandName) => {
            const results: any[] = [];
            
            // Buscar contenedores de versiones con múltiples selectores posibles
            const containers = document.querySelectorAll(
              '.version-item, .car-version, .vehicle-version, ' +
              '[class*="version-card"], [class*="pricing-card"], ' +
              '.swiper-slide, .product-card, .modelo-version'
            );
            
            containers.forEach(container => {
              const data: any = {
                brand: brandName.toUpperCase(),
                model: null,
                version: null,
                precio_lista: null,
                precio_todo_medio_pago: null,
                precio_con_financiamiento: null,
              };
              
              // Extraer nombre de versión
              const versionEl = container.querySelector(
                'h2, h3, h4, .version-name, .title, ' +
                '[class*="version-title"], [class*="model-name"]'
              );
              if (versionEl) {
                const versionText = versionEl.textContent?.trim() || '';
                // Separar modelo y versión si están juntos
                const parts = versionText.split(/\s+/);
                if (parts.length >= 2) {
                  data.model = parts[0].toUpperCase();
                  data.version = versionText.toUpperCase();
                } else {
                  data.version = versionText.toUpperCase();
                }
              }
              
              // Buscar precios con múltiples patrones
              const textContent = container.textContent || '';
              
              // Precio lista
              const precioListaMatch = textContent.match(/Precio\s+lista[:\s]*\$?([\d.,]+)/i);
              if (precioListaMatch) {
                data.precio_lista = precioListaMatch[1].replace(/[^\d]/g, '');
              }
              
              // Precio todo medio de pago
              const precioMedioMatch = textContent.match(/Precio\s+todo\s+medio\s+de\s+pago[:\s]*\$?([\d.,]+)/i);
              if (precioMedioMatch) {
                data.precio_todo_medio_pago = precioMedioMatch[1].replace(/[^\d]/g, '');
              }
              
              // Precio con financiamiento
              const precioFinancMatch = textContent.match(/Precio\s+con\s+financiamiento[:\s]*\$?([\d.,]+)/i);
              if (precioFinancMatch) {
                data.precio_con_financiamiento = precioFinancMatch[1].replace(/[^\d]/g, '');
              }
              
              // Solo agregar si tiene al menos precio lista
              if (data.precio_lista && data.version) {
                results.push(data);
              }
            });
            
            return results;
          }, brand);
          
          // PASO 2: Si no se encontraron versiones, usar IA como respaldo
          if (versions.length === 0) {
            console.log(`   🤖 Extracción DOM vacía, usando IA...`);
            
            const aiResult = await page.extract(`
TAREA: Extraer información de vehículos de la sección "Elige una versión".

IMPORTANTE: 
- Solo extrae de tarjetas con imágenes de vehículos
- NO inventes valores - usa null si no está visible
- Busca específicamente estos textos en la página:
  * "Precio lista $XX.XXX.XXX"
  * "Precio todo medio de pago $XX.XXX.XXX"
  * "Precio con financiamiento $XX.XXX.XXX"
  * "Bono todo medio de pago $X.XXX.XXX"
  * "Bono Financiamiento $X.XXX.XXX"

Para CADA versión visible, extrae:
{
  "brand": "${brand.toUpperCase()}",
  "model": "nombre del modelo",
  "version": "nombre completo de la versión",
  "precio_lista": "solo números sin puntos",
  "precio_todo_medio_pago": "solo números sin puntos o null",
  "precio_con_financiamiento": "solo números sin puntos o null",
  "bono_todo_medio_pago": "solo números sin puntos o null",
  "bono_financiamiento": "solo números sin puntos o null"
}

IMPORTANTE: Los campos bono_* son opcionales - si no los ves explícitamente, déjalos como null.

Retorna un array JSON con todas las versiones encontradas.
            `);
            
            try {
              let content = '';
              if (typeof aiResult === 'string') {
                content = aiResult;
              } else if (typeof aiResult === 'object') {
                const anyResult = aiResult as any;
                content = anyResult.extraction || anyResult.content || 
                         anyResult.choices?.[0]?.message?.content || 
                         JSON.stringify(aiResult);
              }
              
              const jsonMatch = content.match(/\[[\s\S]*?\]/);
              if (jsonMatch) {
                versions = JSON.parse(jsonMatch[0]);
              }
            } catch (e) {
              console.error(`   ❌ Error parseando resultado IA:`, e);
            }
          }
          
          // PASO 3: Procesar y calcular bonos si es necesario
          if (versions.length > 0) {
            versions = versions.map((v: any) => {
              // Normalizar campos
              const normalized: CarData = {
                brand: normalizeText(v.brand || brand),
                model: normalizeText(v.model || modelName.replace(/-/g, ' ')),
                version: normalizeText(v.version || ''),
                precio_lista: v.precio_lista || null,
                bono_todo_medio_pago: v.bono_todo_medio_pago || null,
                bono_financiamiento: v.bono_financiamiento || null,
                precio_todo_medio_pago: v.precio_todo_medio_pago || null,
                precio_con_financiamiento: v.precio_con_financiamiento || null,
                url: modelUrl
              };
              
              // Calcular bonos si no vienen pero tenemos los precios
              if (!normalized.bono_todo_medio_pago && normalized.precio_lista && normalized.precio_todo_medio_pago) {
                normalized.bono_todo_medio_pago = calculateBono(normalized.precio_lista, normalized.precio_todo_medio_pago);
              }
              
              if (!normalized.bono_financiamiento && normalized.precio_lista && normalized.precio_con_financiamiento) {
                normalized.bono_financiamiento = calculateBono(normalized.precio_lista, normalized.precio_con_financiamiento);
              }
              
              return normalized;
            });
            
            // Filtrar duplicados
            const uniqueVersions = versions.reduce((acc: CarData[], current: CarData) => {
              const exists = acc.find(v => 
                v.version === current.version && 
                v.model === current.model
              );
              if (!exists) {
                acc.push(current);
              }
              return acc;
            }, []);
            
            console.log(`   📊 ${uniqueVersions.length} versión(es) extraída(s)`);
            
            // Validar cada versión
            const versionesValidas: CarData[] = [];
            let descartadasModelo = 0;
            
            uniqueVersions.forEach((v: CarData, idx: number) => {
              console.log(`      ${idx + 1}. ${v.version || 'N/A'}`);
              console.log(`         Precio lista: ${v.precio_lista || 'null'}`);
              console.log(`         Bono medio pago: ${v.bono_todo_medio_pago || 'null'}`);
              console.log(`         Bono financ: ${v.bono_financiamiento || 'null'}`);
              console.log(`         Precio todo medio: ${v.precio_todo_medio_pago || 'null'}`);
              console.log(`         Precio con financ: ${v.precio_con_financiamiento || 'null'}`);
              
              if (isValidEntry(v)) {
                versionesValidas.push(v);
                console.log(`         ✅ Válida`);
              } else {
                descartadasModelo++;
                totalDescartados++;
              }
            });
            
            if (descartadasModelo > 0) {
              console.log(`   ⚠️ ${descartadasModelo} versión(es) descartada(s) por validación`);
            }
            
            allCars.push(...versionesValidas);
          } else {
            console.log(`   ⚠️ No se encontraron versiones`);
            
            // Tomar screenshot para debug
            const debugPath = `./debug-${brand}-${modelName}.png`;
            await page.screenshot({ path: debugPath, fullPage: true });
            console.log(`   📸 Screenshot guardado en: ${debugPath}`);
          }
          
        } catch (error) {
          console.error(`   ❌ Error en modelo ${modelName}:`, error);
        }
        
        // Pausa entre modelos
        await page.waitForTimeout(2000);
      }
      
    } catch (error) {
      console.error(`❌ Error procesando marca ${brand}:`, error);
    }
  }
  
  // Resumen final
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(80));
  console.log(`Total de versiones extraídas: ${allCars.length + totalDescartados}`);
  console.log(`Versiones válidas: ${allCars.length}`);
  console.log(`Versiones descartadas: ${totalDescartados}`);
  if (allCars.length + totalDescartados > 0) {
    console.log(`Tasa de validación: ${(allCars.length / (allCars.length + totalDescartados) * 100).toFixed(1)}%`);
  }
  
  if (allCars.length > 0) {
    // Estadísticas detalladas
    const conPrecios = allCars.filter(c => c.precio_lista).length;
    const conBonoMedio = allCars.filter(c => c.bono_todo_medio_pago).length;
    const conBonoFinanc = allCars.filter(c => c.bono_financiamiento).length;
    const conPrecioMedio = allCars.filter(c => c.precio_todo_medio_pago).length;
    const conPrecioFinanc = allCars.filter(c => c.precio_con_financiamiento).length;
    
    console.log(`\nDatos extraídos:`);
    console.log(`  - Con precio lista: ${conPrecios}/${allCars.length}`);
    console.log(`  - Con bono medio pago: ${conBonoMedio}/${allCars.length}`);
    console.log(`  - Con bono financiamiento: ${conBonoFinanc}/${allCars.length}`);
    console.log(`  - Con precio todo medio pago: ${conPrecioMedio}/${allCars.length}`);
    console.log(`  - Con precio con financiamiento: ${conPrecioFinanc}/${allCars.length}`);
    
    // Normalizar y guardar
    const normalized = allCars.map((r: CarData) => normalize(r, "Astara"));
    writeCSV("astara.csv", normalized);
    appendToMerged(normalized);
    console.log("\n✅ CSV guardado en ./output/astara.csv");
  } else {
    console.log("\n⚠️ No se guardó archivo CSV - no hay datos válidos");
  }
  
  await stagehand.close();
}

// Para ejecutar directamente
if (process.argv[1]?.endsWith('astara.ts')) {
  scrapeAstara()
    .then(() => console.log("\n✅ Completado"))
    .catch(console.error);
}