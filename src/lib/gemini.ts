/**
 * Utility for interacting with AI via OpenRouter API.
 * Routes requests through OpenRouter to access Gemini models with better compatibility.
 */

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Using Google Gemini 2.0 Flash (Reliable & Fast on OpenRouter)
const MODEL = "google/gemini-2.0-flash-001"; 

export type ChatMessage = {
  role: 'user' | 'model';
  text: string;
};

const SYSTEM_PROMPT = `You are ScholarMatch AI, a dedicated scholarship assistant for Indian students on the ScholarMatch platform.
Your SOLE purpose is to assist students with:
1. Finding scholarships and understanding eligibility (merit-based, means-based, categories like OBC/SC/ST).
2. Guiding them through the application process on ScholarMatch.
3. Explaining educational terms and financial aid concepts.
4. Helping with profile setup and dashboard navigation.

STRICT GUIDELINES:
- DOMAIN RESTRICTION: You must REFUSE to answer any questions unrelated to scholarships, education, financial aid, or the ScholarMatch platform.
- If asked about general topics (e.g., biology, history, coding, recipes, news, general knowledge, math problems, homework), politely reply: "I specialize only in scholarships and educational guidance for ScholarMatch. I cannot assist with general topics. How can I help you find a scholarship today?"
- Do not provide answers to homework questions or academic subjects.
- Be encouraging, professional, and concise.
`;

export async function sendMessageToGemini(history: ChatMessage[], newMessage: string): Promise<string> {
  if (!API_KEY) {
    console.error("OpenRouter API Key is missing");
    return "I'm sorry, I'm having trouble connecting to my brain right now. Please check the API configuration.";
  }

  try {
    // Convert internal history format to OpenAI/OpenRouter format
    // Map 'model' role to 'assistant' for OpenRouter/OpenAI compatibility
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text
      })),
      { role: "user", content: newMessage }
    ];

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin, // Required by OpenRouter
        'X-Title': 'ScholarMatch', // Optional
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API Error:", response.status, errorData);
      return `I encountered a connection error (${response.status}). Please try again.`;
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      console.error("Unexpected API response format:", data);
      return "I didn't get a clear response. Could you try rephrasing that?";
    }

  } catch (error) {
    console.error("Error calling AI Service:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
}
