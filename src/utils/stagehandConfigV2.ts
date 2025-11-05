import { Stagehand } from "@browserbasehq/stagehand";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

class OpenAIAdapter {
  private openai: OpenAI;
  
  type = "openai";
  modelName = "gpt-4o-mini"; // Modelo económico pero efectivo con buenas instrucciones
  hasVision = true;
  clientOptions = {};
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }
  
  async createChatCompletion(params: any) {
    try {
      // Extraer mensajes con múltiples fallbacks
      let messages = params.messages || params.options?.messages || params.body?.messages || [];
      
      if (!messages || messages.length === 0) {
        console.error("❌ No se encontraron mensajes en params:", JSON.stringify(params, null, 2));
        throw new Error("No messages found in params");
      }
      
      // Procesar mensajes - manejar contenido con imágenes
      const formattedMessages = messages.map((msg: any) => {
        // Si el contenido es un array (puede contener imágenes)
        if (Array.isArray(msg.content)) {
          return {
            role: msg.role,
            content: msg.content.map((item: any) => {
              if (item.type === 'text') {
                return { type: 'text', text: item.text };
              } else if (item.type === 'image_url') {
                return { type: 'image_url', image_url: item.image_url };
              }
              return item;
            })
          };
        }
        
        // Contenido simple de texto
        return {
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        };
      });
      
      // Extraer tool_choice si existe
      const toolChoice = params.tool_choice || params.options?.tool_choice;
      
      // Extraer tools si existen
      const tools = params.tools || params.options?.tools;
      
      // Crear la petición a OpenAI con todos los parámetros posibles
      const requestParams: any = {
        model: this.modelName,
        messages: formattedMessages,
        max_tokens: params.max_tokens || params.options?.max_tokens || 16000,
        temperature: params.temperature || params.options?.temperature || 0.1,
      };
      
      // Añadir tools si existen
      if (tools && tools.length > 0) {
        requestParams.tools = tools;
        if (toolChoice) {
          requestParams.tool_choice = toolChoice;
        }
      }
      
      // Log para debug (solo en verbose)
      if (process.env.STAGEHAND_DEBUG === 'true') {
        console.log("📤 Enviando a OpenAI:", {
          model: requestParams.model,
          messagesCount: formattedMessages.length,
          hasTools: !!tools,
          toolChoice: toolChoice
        });
      }
      
      const response = await this.openai.chat.completions.create(requestParams);
      
      // Log de respuesta (solo en verbose)
      if (process.env.STAGEHAND_DEBUG === 'true') {
        console.log("📥 Respuesta de OpenAI:", {
          choices: response.choices.length,
          finishReason: response.choices[0]?.finish_reason,
          hasToolCalls: !!response.choices[0]?.message?.tool_calls
        });
      }
      
      return {
        choices: response.choices,
        usage: response.usage,
        model: response.model,
        id: response.id
      };
    } catch (error: any) {
      console.error("❌ Error en OpenAI API:", {
        message: error.message,
        status: error.status,
        type: error.type
      });
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
    verbose: 2, // Aumentado a 2 para más logs
    headless: false,
    debugDom: true, // Habilitar debug del DOM
    enableCaching: true, // Habilitar caché para ahorrar tokens
    // Configuraciones adicionales para mejorar estabilidad
    domSettleTimeoutMs: 3000, // Esperar más tiempo para que el DOM se estabilice
  });
  
  await stagehand.init();
  console.log("✅ Stagehand inicializado con OpenAI GPT-4o-mini");
  console.log("   📊 Verbose: 2");
  console.log("   🐛 Debug DOM: true");
  console.log("   💾 Caché: true");
  console.log("   💰 Modo económico activado");
  
  return stagehand;
}

// Función auxiliar para crear Stagehand con modelo específico
export async function createStagehandWithModel(modelName: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no está definida en .env");
  }
  
  const openaiClient = new OpenAIAdapter(process.env.OPENAI_API_KEY);
  openaiClient.modelName = modelName;
  
  const stagehand = new Stagehand({
    env: "LOCAL",
    llmClient: openaiClient as any,
    verbose: 2,
    headless: false,
    debugDom: true,
    enableCaching: true,
    domSettleTimeoutMs: 3000,
  });
  
  await stagehand.init();
  console.log(`✅ Stagehand inicializado con OpenAI ${modelName}`);
  
  return stagehand;
}

// Export explícito adicional para TypeScript
export { createStagehand as default };