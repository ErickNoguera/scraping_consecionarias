import { Stagehand } from "@browserbasehq/stagehand";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

class OpenAIAdapter {
  private openai: OpenAI;
  
  type = "openai";
  modelName = "gpt-4o-mini";
  hasVision = true;
  clientOptions = {};
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  async createChatCompletion(params: any) {
    try {
      // Extraer mensajes
      let messages = params.messages || params.options?.messages || [];
      
      if (!messages || messages.length === 0) {
        console.error("No se encontraron mensajes en params");
        throw new Error("No messages found in params");
      }
      
      // Asegurar que los mensajes tienen el formato correcto
      const formattedMessages = messages.map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));
      
      // Crear la petición a OpenAI
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: formattedMessages,
        max_tokens: params.max_tokens || params.options?.max_tokens || 4096,
        temperature: params.temperature || params.options?.temperature || 0.1
      });
      
      return {
        choices: response.choices,
        usage: response.usage,
        model: response.model,
        id: response.id
      };
    } catch (error) {
      console.error("Error en OpenAI:", error);
      throw error;
    }
  }
  
  async *createChatCompletionStream(params: any) {
    const response = await this.createChatCompletion(params);
    yield response;
  }
}

export async function createStagehand() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no está definida en .env");
  }
  
  const openaiClient = new OpenAIAdapter(process.env.OPENAI_API_KEY);
  
  const stagehand = new Stagehand({
    env: "LOCAL",
    llmClient: openaiClient as any,
    verbose: 1,
    headless: false
  });
  
  await stagehand.init();
  console.log("✅ Stagehand inicializado con OpenAI GPT-4o-mini");
  
  return stagehand;
}

// Export explícito adicional para TypeScript
export { createStagehand as default };