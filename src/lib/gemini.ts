import { GoogleGenAI, Type } from "@google/genai";

export interface AnalysisResult {
  market: string;
  direction: "UP" | "DOWN" | "SIDEWAYS";
  confidence: string;
  logic: string;
  insights: string;
}

export async function analyzeChart(base64Image: string, mimeType: string, apiKey?: string): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
      {
        text: `You are "Sharfin's AI", a professional chart analysis assistant.
Analyze the uploaded trading chart screenshot and provide a structured output.
Do not give financial advice; only provide technical analysis insights.`,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          market: {
            type: Type.STRING,
            description: "Name of market/asset detected",
          },
          direction: {
            type: Type.STRING,
            description: "UP / DOWN / SIDEWAYS",
            enum: ["UP", "DOWN", "SIDEWAYS"],
          },
          confidence: {
            type: Type.STRING,
            description: "Percentage %",
          },
          logic: {
            type: Type.STRING,
            description: "Concise explanation of why the signal direction was chosen. Mention candlestick patterns, support/resistance, moving averages, RSI/MACD, or volume trends.",
          },
          insights: {
            type: Type.STRING,
            description: "Optional notes: risk factors, false breakout chances, low volume, external events, or cautionary advice.",
          },
        },
        required: ["market", "direction", "confidence", "logic", "insights"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(text) as AnalysisResult;
}
