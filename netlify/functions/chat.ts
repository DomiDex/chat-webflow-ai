// netlify/functions/chat.ts
// Use types from the installed package
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

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

// Use the Handler type from @netlify/functions
const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  // 1. Check Request Method (using event.httpMethod)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  // 2. Get API Key (from Netlify environment variables - use process.env for Node.js fallback)
  const apiKey = process.env.GOOGLE_AI_API_KEY; // Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    console.error(
      'Google AI API Key not configured in Netlify environment variables.'
    );
    return {
      statusCode: 500,
      body: 'Internal Server Error: API Key missing',
    };
  }

  try {
    // 3. Parse Incoming Request Body (using event.body)
    if (!event.body) {
      return {
        statusCode: 400,
        body: 'Bad Request: Missing request body.',
      };
    }
    const { message, history = [] }: ChatRequestBody = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        body: "Bad Request: 'message' is required.",
      };
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

    // 5. Call Google AI API (fetch still works)
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
      return {
        statusCode: aiResponse.status,
        body: `AI Service Error: ${aiResponse.statusText}`,
      };
    }

    // 7. Parse AI Response
    const aiData = await aiResponse.json();

    // Extract the response text (adapt based on actual API response structure)
    // This is a common structure, but VERIFY with Google's documentation
    const replyText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a response.";

    // 8. Send Response Back to Webflow (return object with statusCode, headers, body)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // IMPORTANT: Set CORS headers to allow requests from your Webflow domain
        // Replace '*' with your specific Webflow domain for better security in production
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ reply: replyText }),
    };
  } catch (error) {
    console.error('Error processing chat request:', error);
    // Type guard for unknown error
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      statusCode: 500,
      body: `Internal Server Error: ${errorMessage}`,
    };
  }
};

// Export the handler
export { handler };

// Optional: Handle OPTIONS requests for CORS preflight
// The config object might need adjustment or removal if using the Handler type primarily
// Netlify often handles OPTIONS implicitly when CORS headers are present on POST
// export const config = {
//     path: "/api/chat", // Or use the filename 'chat' -> /.netlify/functions/chat
//     method: ["POST", "OPTIONS"], // Allow POST and OPTIONS
//   };
