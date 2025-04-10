import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// --- Removed file system imports ---

interface ChatRequestBody {
  message: string;
  history?: { role: string; parts: { text: string }[] }[];
}

// Google AI API endpoint
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
  // Background functions are often triggered via POST
  if (event.httpMethod !== 'POST') {
    console.log('Background function called with non-POST method');
    return { statusCode: 405 }; // Method Not Allowed
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error('BACKGROUND ERROR: Google AI API Key missing');
    return { statusCode: 500 }; // Internal error, won't be seen by original client
  }

  try {
    // 1. Parse body sent FROM THE TRIGGER function
    if (!event.body) {
      console.error('BACKGROUND ERROR: Missing request body.');
      return { statusCode: 400 };
    }
    // Assuming trigger sends { message: '...', history: [...] }
    const { message, history = [] }: ChatRequestBody = JSON.parse(event.body);

    if (!message) {
      console.error("BACKGROUND ERROR: 'message' is required.");
      return { statusCode: 400 };
    }

    // 2. Prepare Payload for Google AI API
    const aiPayload = {
      system_instruction: {
        parts: [{ text: webflowApiDocs.systemPromptSummary }],
      },
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      generationConfig: {
        maxOutputTokens: 1000, // Keep this for now
      },
    };

    console.log('BACKGROUND: Calling Google AI API...');

    // 3. Call Google AI API (NO AbortController needed for background)
    const aiResponse = await fetch(`${GOOGLE_AI_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiPayload),
      // NO signal/timeout here
    });

    // 4. Handle AI Response Status
    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      console.error(
        `BACKGROUND Google AI API Error (${aiResponse.status}): ${errorBody}`
      );
      // Decide how to handle failure (e.g., log, potentially retry?)
      return { statusCode: 502 }; // Bad Gateway (error from upstream service)
    }

    // 5. Parse AI Response
    const aiData = await aiResponse.json();
    const replyText =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'BACKGROUND: No response text generated.';

    // 6. LOG the result (Cannot send back to original client directly)
    console.log('BACKGROUND SUCCESS: AI Reply:', replyText);

    // Background functions should return 200 OK if they complete successfully
    return {
      statusCode: 200,
      body: 'Background task completed.', // This response isn't seen by the original user
    };
  } catch (error) {
    console.error('BACKGROUND CRITICAL ERROR:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Return 500 to indicate background task failure
    return {
      statusCode: 500,
      body: `Background task failed: ${errorMessage}`,
    };
  }
};

export { handler };
