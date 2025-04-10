// netlify/functions/chat.ts
import { Context } from 'https://edge.netlify.com/'; // Netlify Edge Context (works for regular functions too)

// Define the expected structure of the request body from Webflow
interface ChatRequestBody {
  message: string;
  // Include history for context-aware chat
  // Structure based on Google AI API requirements
  history?: { role: string; parts: { text: string }[] }[];
}

// Google AI API endpoint (UPDATE THIS based on the model you're using)
// Example for Gemini 1.5 Pro via Generative Language API
const GOOGLE_AI_API_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';

export default async (request: Request, context: Context) => {
  // 1. Check Request Method
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. Get API Key (from Netlify environment variables)
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    console.error(
      'Google AI API Key not configured in Netlify environment variables.'
    );
    return new Response('Internal Server Error: API Key missing', {
      status: 500,
    });
  }

  try {
    // 3. Parse Incoming Request Body
    const { message, history = [] }: ChatRequestBody = await request.json();

    if (!message) {
      return new Response("Bad Request: 'message' is required.", {
        status: 400,
      });
    }

    // 4. Prepare Payload for Google AI API
    //    (Adapt this structure based on the specific Google AI model API docs)
    const aiPayload = {
      contents: [
        // Include previous history for context
        ...history,
        // Add the new user message
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ],
      // Optional: Add generation config (temperature, max tokens, etc.)
      // generationConfig: {
      //   temperature: 0.7,
      //   maxOutputTokens: 1000,
      // },
      // Optional: Safety settings
      // safetySettings: [ ... ]
    };

    // 5. Call Google AI API
    const aiResponse = await fetch(
      `${GOOGLE_AI_API_ENDPOINT}?key=${apiKey}`, // API key as query param
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiPayload),
      }
    );

    // 6. Handle AI Response Status
    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      console.error(`Google AI API Error (${aiResponse.status}): ${errorBody}`);
      return new Response(`AI Service Error: ${aiResponse.statusText}`, {
        status: aiResponse.status,
      });
    }

    // 7. Parse AI Response
    const aiData = await aiResponse.json();

    // Extract the response text (adapt based on actual API response structure)
    // This is a common structure, but VERIFY with Google's documentation
    const replyText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a response.";

    // 8. Send Response Back to Webflow
    return new Response(JSON.stringify({ reply: replyText }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // IMPORTANT: Set CORS headers to allow requests from your Webflow domain
        // Replace '*' with your specific Webflow domain for better security in production
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error processing chat request:', error);
    // Type guard for unknown error
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new Response(`Internal Server Error: ${errorMessage}`, {
      status: 500,
    });
  }
};

// Optional: Handle OPTIONS requests for CORS preflight
export const config = {
  path: '/api/chat', // Or use the filename 'chat' -> /.netlify/functions/chat
  method: ['POST', 'OPTIONS'], // Allow POST and OPTIONS
};

// You might need a specific handler for OPTIONS if the default doesn't suffice
// or rely on Netlify's automatic handling based on the returned headers in the POST response.
// If issues arise, explicitly handle OPTIONS:
// if (request.method === "OPTIONS") {
//   return new Response(null, {
//     status: 204, // No Content
//     headers: {
//       "Access-Control-Allow-Origin": "*", // Or specific domain
//       "Access-Control-Allow-Methods": "POST, OPTIONS",
//       "Access-Control-Allow-Headers": "Content-Type",
//       "Allow": "POST, OPTIONS",
//     },
//   });
// }
