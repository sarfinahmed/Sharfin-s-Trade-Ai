import { GoogleGenAI, Type } from "@google/genai";

export interface AnalysisResult {
  market: string;
  direction: "UP" | "DOWN" | "SIDEWAYS";
  confidence: string;
  logic: string;
  insights: string;
  tradeTiming?: string;
  entryPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  expirationTime?: string;
}

export async function analyzeChart(base64Image: string, mimeType: string, apiKey?: string, broker?: string): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
  
  let brokerContext = "";
  const bLow = broker?.toLowerCase() || "";
  
  if (['exness', 'binance'].includes(bLow)) {
    brokerContext = `The user is trading on ${broker}. This is a Margin/Spot trading platform. 
You MUST provide estimated strict numerical price values for 'entryPrice', 'stopLoss', and 'takeProfit' based on the visible support, resistance, and market structure in the chart. If exact prices are hard to read, provide the specific pip/point/percentage distances (e.g., 'Entry at current price, SL 20 pips below, TP 40 pips above'). Tell the user exactly how much Stop Loss and Take Profit to set. Do not give binary options advice here.`;
  } else if (bLow === 'quotex') {
    brokerContext = `The user is trading on Quotex (Binary Options / Fixed Time Trades). 
CRITICAL: The user has noticed that previous predictions for Quotex were frequently wrong (predicting a reversal when the trend continues, or predicting continuation when it reverses). 
To strictly fix this: Pay extreme, hyper-focused attention to candlestick wicks (rejection), momentum exhaustion, and immediate S/R zones. Do not blindly predict "Next Candle" without heavy confluence. Provide a safe 'expirationTime' (e.g., 1m, 3m, 5m).`;
  } else if (['pocket_option', 'iq_option', 'olymptrade'].includes(bLow)) {
    brokerContext = `The user is trading on ${broker} (Binary Options / Fixed Time Trades). 
Focus on precise candle-by-candle analysis and provide a recommended 'expirationTime' (e.g., 1 minute, 5 minutes).`;
  } else {
    brokerContext = `The user is trading on ${broker || "an unknown broker"}. Adapt your analysis accordingly.`;
  }

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
        text: `You are "Sharfin's AI", an elite professional chart analysis assistant.
Analyze the uploaded trading chart screenshot and provide a structured output.
Do not give financial advice; only provide technical analysis insights.
${brokerContext}
Pay special attention to whether the trading signal should be executed on the current candle or if the user should wait for the next candle.`,
      },
    ],
    config: {
      temperature: 0.1,
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
          tradeTiming: {
            type: Type.STRING,
            description: "When to take the trade. Strictly output one of: 'Current Candle', 'Next Candle', or 'Wait'.",
          },
          entryPrice: {
            type: Type.STRING,
            description: "Estimated entry price level (Required for Exness/Binance, otherwise leave empty).",
          },
          stopLoss: {
            type: Type.STRING,
            description: "Stop loss price level (Required for Exness/Binance, otherwise leave empty).",
          },
          takeProfit: {
            type: Type.STRING,
            description: "Take profit price level (Required for Exness/Binance, otherwise leave empty).",
          },
          expirationTime: {
            type: Type.STRING,
            description: "Recommended trade duration/expiration (e.g., '1 Minute', '5 Minutes'). Only for binary options brokers like Quotex, Pocket Option, etc.",
          },
        },
        required: ["market", "direction", "confidence", "logic", "insights", "tradeTiming"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(text) as AnalysisResult;
}
