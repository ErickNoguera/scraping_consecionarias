import { Stagehand, ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";
import path from "path";

// Cargar .env desde la raíz del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function createStagehand() {
  // Debug
  console.log("🔍 Verificando ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ? "✓" : "✗");
  
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY no está definida en .env");
  }
  
  const config: ConstructorParams = {
    env: "LOCAL",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    modelName: "claude-3-haiku-20240307" as any,
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY
    } as any,
    verbose: 1,
  };
  
  const stagehand = new Stagehand(config);
  await stagehand.init();
  return stagehand;
}