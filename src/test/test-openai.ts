import OpenAI from "openai";

// 🔍 Debug
console.log("🔑 OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Cargada" : "❌ NO cargada");
console.log("🔑 Primeros caracteres:", process.env.OPENAI_API_KEY?.substring(0, 10) || "N/A");

// Crear cliente
const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Probar conexión
try {
  console.log("\n🔄 Consultando modelos disponibles...");
  const models = await client.models.list();
  console.log("✅ Modelos disponibles:");
  models.data.slice(0, 10).forEach(m => console.log(`  - ${m.id}`));
} catch (error: any) {
  console.error("❌ Error:", error.message);
}