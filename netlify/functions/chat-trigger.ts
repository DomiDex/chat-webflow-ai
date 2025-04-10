import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
// import { Buffer } from 'node:buffer'; // No longer needed for fetch invocation

// Define the structure expected from the client AND used for AI call
// Renamed from ClientChatRequestBody for clarity
interface ChatRequestBody {
  message: string;
  history?: { role: string; parts: { text: string }[] }[];
}

// --- Constants moved from chat-background.ts ---
const GOOGLE_AI_API_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';

// Embed the API docs summary directly as a JS object
const webflowApiDocs = {
  systemPromptSummary:
    'Core Functionality\nPurpose: Interact programmatically with Webflow site data via a RESTful API (v2).\nKey Capabilities:\nCMS Management: Create, read, update, delete, publish, and unpublish Collections and Items. This is a primary function.\nSite Management: Retrieve site details (info, domains, locales), list accessible sites, and publish sites.\nForm Data: Access submissions from native Webflow forms.\nWebhooks: Manage webhook subscriptions to receive real-time event notifications (e.g., form submission, site publish, CMS changes).\nOther: Manage Assets (upload/list), Custom Code, User Accounts (Memberships), and Ecommerce data (Products, Orders, Inventory).\n\nAuthentication\nMethod: Requires an Authorization: Bearer <TOKEN> header in all requests.\nToken Types: Use either an OAuth 2.0 access_token (obtained via Authorization Code flow, standard for apps) or a Site API Token (generated in site settings, for single-site integrations).\nPermissions: Actions are limited by the scopes granted to the token (e.g., cms:read, cms:write, sites:read, sites:write, cms:publish). Ensure the token has the necessary scopes for the intended operation.\n\nKey Interaction Patterns\nProtocol: REST API using standard HTTP methods (GET, POST, PATCH, DELETE) and JSON for request/response bodies.\nEndpoints: Follow predictable patterns (e.g., /v2/sites, /v2/sites/{site_id}/collections, /v2/collections/{collection_id}/items, /v2/collections/{collection_id}/items/{item_id}). Use API version /v2/.\nCMS Workflow: Managing CMS items involves understanding staged vs. live states. Use isDraft flag, live parameter (in POST/PATCH requests), and specific publish/unpublish endpoints (POST.../publish, DELETE.../live) to control content visibility.\n\nData Structures\nFormat: All data is exchanged as JSON objects.\nKey Objects: Understand the structure of Site , Collection , and Item  objects.\nDynamic Content (fieldData): Item objects contain a fieldData object holding the actual content. Crucially, the structure of fieldData varies depending on the specific Collection\'s schema. Before creating or updating an Item, you may need to first fetch the Collection\'s schema (GET /v2/collections/{collection_id}) to determine the correct fields and types required within fieldData.\n\nConstraints & Error Handling\nRate Limits: Be mindful of strict rate limits (60 or 120 requests/minute per token, based on plan). Site publish is limited to 1/minute. Monitor usage via X-RateLimit-Remaining header. Use webhooks instead of polling.\n429 Errors: Exceeding limits triggers a 429 Too Many Requests error (code: "too_many_requests"). Respect the Retry-After header value before retrying.\nOther Errors: Expect standard HTTP errors (400, 401, 404, 409, 500). Error responses are JSON objects containing message and code fields (e.g., code: "resource_not_found", code: "conflict"). Handle these errors appropriately.\nVersioning: Target API version v2 using the /v2/ path prefix.',
};
// --- End of moved constants ---

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  // --- Get API Key (Moved from background function) ---
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('FUNCTION ERROR: Google AI API Key missing');
    return {
      statusCode: 500,
      body: 'Internal Server Error: API key configuration missing.',
    };
  }
  // --- End of API Key logic ---

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: 'Bad Request: Missing request body.',
      };
    }

    // Parse the original request body
    const { message, history = [] }: ChatRequestBody = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        body: "Bad Request: 'message' is required.",
      };
    }

    // --- Logic to call Google AI (Moved from background function) ---

    // 1. Prepare Payload for Google AI API
    const aiPayload = {
      system_instruction: {
        parts: [{ text: webflowApiDocs.systemPromptSummary }],
      },
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      generationConfig: {
        maxOutputTokens: 1000, // Keep this for now
      },
    };

    console.log('Calling Google AI API...');

    // 2. Call Google AI API
    // Use AbortController for timeout (recommended for synchronous functions)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 seconds timeout

    let aiResponse;
    try {
      aiResponse = await fetch(`${GOOGLE_AI_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload),
        signal: controller.signal, // Add signal for timeout
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId); // Clear timeout if fetch itself failed
      if (fetchError.name === 'AbortError') {
        console.error('Google AI API call timed out.');
        return {
          statusCode: 504,
          body: 'Gateway Timeout: AI response took too long.',
        };
      }
      console.error('Error fetching from Google AI API:', fetchError);
      return {
        statusCode: 502,
        body: `Bad Gateway: Error contacting AI service. Details: ${
          fetchError.message || fetchError
        }`,
      };
    } finally {
      clearTimeout(timeoutId); // Always clear timeout after fetch attempt
    }

    // 3. Handle AI Response Status
    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      console.error(`Google AI API Error (${aiResponse.status}): ${errorBody}`);
      // Return specific error codes if possible
      return {
        statusCode: aiResponse.status === 429 ? 429 : 502, // Handle rate limits (429) or other errors (502)
        body: `AI Service Error (${aiResponse.status}): ${errorBody}`,
      };
    }

    // 4. Parse AI Response
    const aiData = await aiResponse.json();
    const replyText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response text generated.';

    console.log('SUCCESS: AI Reply received.');

    // 5. Return 200 OK with the AI's reply directly to the client
    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: replyText, // Send the AI reply back
        history: [
          ...history,
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: replyText }] },
        ], // Optionally return updated history
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Keep CORS headers if needed
      },
    };
    // --- End of Google AI logic ---
  } catch (error) {
    // General error handling (e.g., JSON parsing errors)
    console.error('Error in chat function:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      statusCode: 500,
      body: `Function error: ${errorMessage}`,
    };
  }
};

export { handler };
