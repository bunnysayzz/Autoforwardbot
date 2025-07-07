import { NextRequest, NextResponse } from 'next/server';
import { handleMessage } from '../../../../scripts/bot';
import { isAdmin } from '../../../../lib/telegram';
import { Update } from 'node-telegram-bot-api';
import { loadChannels } from '../../../../lib/storage';

// Validate webhook secret
function validateSecret(request: NextRequest): boolean {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const validSecret = process.env.WEBHOOK_SECRET;
  
  if (!validSecret) {
    console.error('WEBHOOK_SECRET is not defined in environment variables');
    return false;
  }
  
  return secret === validSecret;
}

// Use the newer runtime export instead of config
export const runtime = 'nodejs'; // Explicitly set nodejs runtime

// Make sure edge functions don't cache this route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// The webhook route only receives updates and queues them for processing
export async function POST(request: NextRequest) {
  console.log('Webhook POST request received');
  console.log('Environment:', {
    isVercel: process.env.VERCEL === '1',
    nodeEnv: process.env.NODE_ENV,
    botUsername: process.env.BOT_USERNAME
  });
  
  // Validate the secret token
  if (!validateSecret(request)) {
    console.error('Invalid webhook secret');
    return NextResponse.json(
      { success: false, error: 'Invalid webhook secret' }, 
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
  
  try {
    const update: Update = await request.json();
    console.log('Received update:', JSON.stringify(update));

    // Process the update if it contains a message
    if (update.message) {
      // Check if the message is from an admin
      const userId = update.message.from?.id;
      console.log(`Message from user ID: ${userId}`);
      
      if (!isAdmin(userId)) {
        console.log(`Unauthorized webhook access from user ${userId}`);
        return NextResponse.json(
          { success: false, error: 'Unauthorized' }, 
          { 
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, max-age=0'
            }
          }
        );
      }
      
      // Check current storage state
      const currentChannels = loadChannels();
      console.log('Current stored channels:', currentChannels);
      
      // Handle the message
      console.log('Processing message from admin user');
      await handleMessage(update.message);
      
      // Check if storage changed
      const updatedChannels = loadChannels();
      console.log('Updated stored channels:', updatedChannels);
      
      return NextResponse.json(
        { success: true },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

    console.log('Update received but no message to process');
    return NextResponse.json(
      { success: true, info: 'Update received but no message to process' },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: `Error processing webhook: ${(error as Error).message}` },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}

// Required for Vercel
export async function GET(request: NextRequest) {
  console.log('Webhook GET request received');
  console.log('Environment:', {
    isVercel: process.env.VERCEL === '1',
    nodeEnv: process.env.NODE_ENV,
    botUsername: process.env.BOT_USERNAME
  });
  
  if (!validateSecret(request)) {
    console.error('Invalid webhook secret on GET request');
    return NextResponse.json(
      { success: false, error: 'Invalid webhook secret' }, 
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
  
  // Check current storage state
  const currentChannels = loadChannels();
  console.log('Current stored channels:', currentChannels);
  
  console.log('Valid webhook GET request - endpoint is active');
  return NextResponse.json(
    { 
      status: 'Telegram webhook endpoint is active', 
      bot: process.env.BOT_USERNAME,
      channels: currentChannels.length
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
