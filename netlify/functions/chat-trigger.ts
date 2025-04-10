import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
// import { Buffer } from 'node:buffer'; // No longer needed for fetch invocation

// Define the structure expected from the client
interface ClientChatRequestBody {
  message: string;
  history?: { role: string; parts: { text: string }[] }[];
}

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

  // We don't need the API key here, the background function uses it.

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: 'Bad Request: Missing request body.',
      };
    }

    // Parse the original request body
    const requestBody: ClientChatRequestBody = JSON.parse(event.body);
    const { message, history = [] } = requestBody;

    if (!message) {
      return {
        statusCode: 400,
        body: "Bad Request: 'message' is required.",
      };
    }

    // Prepare payload to send to the background function
    // Needs to match what chat-background expects
    const backgroundPayload = {
      message: message,
      history: history,
    };

    // Trigger the background function via internal fetch
    console.log('Triggering background function via fetch: chat-background');
    try {
      const invokeUrl = `/.netlify/functions/chat-background`; // Relative URL
      await fetch(invokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Netlify-Functions-Background': 'true', // Header to trigger background
        },
        body: JSON.stringify(backgroundPayload),
      });
      console.log('Background function triggered via fetch.');
    } catch (invokeError) {
      console.error(
        'Error triggering background function via fetch:',
        invokeError
      );
      return {
        statusCode: 500,
        body: 'Internal Server Error: Could not invoke background task via fetch.',
      };
    }

    // Return 202 Accepted - telling the client the request is being processed
    return {
      statusCode: 202,
      body: JSON.stringify({
        message:
          'Chat request received and is being processed in the background.',
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Keep CORS headers if needed
      },
    };
  } catch (error) {
    console.error('Error in trigger function:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      statusCode: 500,
      body: `Trigger function error: ${errorMessage}`,
    };
  }
};

export { handler };
