import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Buffer } from 'node:buffer'; // Required for payload encoding

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

    // Trigger the background function
    // Note: Background functions are invoked via context.clientContext
    if (context.clientContext?.identity && context.clientContext?.user) {
      console.log('Triggering background function: chat-background');
      await context.clientContext.functions.invoke(
        'chat-background', // Name of the background function file (without extension)
        {
          body: JSON.stringify(backgroundPayload),
        }
      );
      console.log('Background function triggered.');

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
    } else {
      console.error(
        'Error: Could not trigger background function due to missing clientContext.'
      );
      // This might happen during local dev if not properly logged in/linked
      return {
        statusCode: 500,
        body: 'Internal Server Error: Could not invoke background task.',
      };
    }
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
