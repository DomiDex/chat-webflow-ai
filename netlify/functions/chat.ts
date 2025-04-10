// netlify/functions/chat.ts
// Use types from the installed package
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
// import * as path from 'path'; // No longer needed
// import * as fs from 'fs';   // No longer needed

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

// Embed the API docs summary directly as a JS object
const webflowApiDocs = {
  systemPromptSummary:
    'Core Functionality\nPurpose: Interact programmatically with Webflow site data via a RESTful API (v2).\nKey Capabilities:\nCMS Management: Create, read, update, delete, publish, and unpublish Collections and Items. This is a primary function.\nSite Management: Retrieve site details (info, domains, locales), list accessible sites, and publish sites.\nForm Data: Access submissions from native Webflow forms.\nWebhooks: Manage webhook subscriptions to receive real-time event notifications (e.g., form submission, site publish, CMS changes).\nOther: Manage Assets (upload/list), Custom Code, User Accounts (Memberships), and Ecommerce data (Products, Orders, Inventory).\n\nAuthentication\nMethod: Requires an Authorization: Bearer <TOKEN> header in all requests.\nToken Types: Use either an OAuth 2.0 access_token (obtained via Authorization Code flow, standard for apps) or a Site API Token (generated in site settings, for single-site integrations).\nPermissions: Actions are limited by the scopes granted to the token (e.g., cms:read, cms:write, sites:read, sites:write, cms:publish). Ensure the token has the necessary scopes for the intended operation.\n\nKey Interaction Patterns\nProtocol: REST API using standard HTTP methods (GET, POST, PATCH, DELETE) and JSON for request/response bodies.\nEndpoints: Follow predictable patterns (e.g., /v2/sites, /v2/sites/{site_id}/collections, /v2/collections/{collection_id}/items, /v2/collections/{collection_id}/items/{item_id}). Use API version /v2/.\nCMS Workflow: Managing CMS items involves understanding staged vs. live states. Use isDraft flag, live parameter (in POST/PATCH requests), and specific publish/unpublish endpoints (POST.../publish, DELETE.../live) to control content visibility.\n\nData Structures\nFormat: All data is exchanged as JSON objects.\nKey Objects: Understand the structure of Site , Collection , and Item  objects.\nDynamic Content (fieldData): Item objects contain a fieldData object holding the actual content. Crucially, the structure of fieldData varies depending on the specific Collection\'s schema. Before creating or updating an Item, you may need to first fetch the Collection\'s schema (GET /v2/collections/{collection_id}) to determine the correct fields and types required within fieldData.\n\nConstraints & Error Handling\nRate Limits: Be mindful of strict rate limits (60 or 120 requests/minute per token, based on plan). Site publish is limited to 1/minute. Monitor usage via X-RateLimit-Remaining header. Use webhooks instead of polling.\n429 Errors: Exceeding limits triggers a 429 Too Many Requests error (code: "too_many_requests"). Respect the Retry-After header value before retrying.\nOther Errors: Expect standard HTTP errors (400, 401, 404, 409, 500). Error responses are JSON objects containing message and code fields (e.g., code: "resource_not_found", code: "conflict"). Handle these errors appropriately.\nVersioning: Target API version v2 using the /v2/ path prefix.',
};

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

  // 2. Get API Key (Use process.env as Netlify seems to be using Node.js runtime despite config)
  const apiKey = process.env.GOOGLE_AI_API_KEY;
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
      system_instruction: {
        // Use the summary from the embedded JS object
        parts: [{ text: webflowApiDocs.systemPromptSummary }],
      },
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
      generationConfig: {
        maxOutputTokens: 1000,
      },
      // Optional: Safety settings
      // safetySettings: [ ... ]
    };

    // 5. Call Google AI API (fetch still works)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 209500); // 9.5 seconds timeout

    try {
      const aiResponse = await fetch(
        `${GOOGLE_AI_API_ENDPOINT}?key=${apiKey}`, // API key as query param
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiPayload),
          signal: controller.signal, // Add the abort signal here
        }
      );
      clearTimeout(timeoutId); // Clear the timeout if fetch completes in time

      // 6. Handle AI Response Status
      if (!aiResponse.ok) {
        const errorBody = await aiResponse.text();
        console.error(
          `Google AI API Error (${aiResponse.status}): ${errorBody}`
        );
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
      clearTimeout(timeoutId); // Ensure timeout is cleared on error too
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Google AI API call timed out before Netlify limit.');
        return {
          statusCode: 504, // Gateway Timeout
          body: 'Error: AI service request timed out.',
        };
      }
      // Re-throw other errors or handle them as before
      throw error;
    }
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
