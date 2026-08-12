import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/api/gemini", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Mensagem vazia.",
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction:
          "Você é um assistente de estudos. Explique os assuntos de forma clara, simples e adequada para estudantes. Quando possível, use exemplos e organize a resposta em tópicos.",
      },
    });

    res.json({
      response: response.text,
    });
  } catch (error) {
    console.error("Erro na Gemini:", error);

    res.status(500).json({
      error: "Não foi possível obter uma resposta da Gemini.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
