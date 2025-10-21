import { createStagehand } from "../utils/stagehandConfig";

async function testConfig() {
  console.log("🧪 Probando configuración...");
  
  try {
    const stagehand = await createStagehand();
    const page = stagehand.page;
    
    // Ir a una página simple
    await page.goto("https://example.com");
    
    // Probar extracción simple
    const result = await page.extract("What is the main title of this page?");
    console.log("✅ Extracción exitosa:", result);
    
    await stagehand.close();
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testConfig();