import { NextRequest, NextResponse } from 'next/server';
import { handleMessage, handleCallbackQuery } from '../../../../scripts/bot';
import { isAdmin } from '../../../../lib/telegram';
import { Update } from 'node-telegram-bot-api';
import { loadChannels, addChannel } from '../../../../lib/storage';

// Validate webhook secret
function validateSecret(request: NextRequest): boolean {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const validSecret = process.env.WEBHOOK_SECRET;
  
  console.log(`Validating webhook secret: ${secret?.substring(0, 3)}*** against ${validSecret?.substring(0, 3)}***`);
  
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
  
  // Log all environment variables (without values for security)
  console.log('Available env vars:', Object.keys(process.env).join(', '));
  
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

    // Check for pending scheduled posts on every webhook call (serverless scheduling)
    console.log('SCHEDULING: Starting scheduled post check...');
    try {
      console.log('SCHEDULING: Importing scheduler modules...');
      const { executeScheduledPosts, getCurrentTime } = await import('../../../../lib/scheduler');
      const { default: bot } = await import('../../../../lib/telegram');
      
      console.log('SCHEDULING: Getting current time...');
      const currentTime = getCurrentTime();
      console.log(`SCHEDULING: Current IST time is ${currentTime}`);
      
      console.log('SCHEDULING: Executing scheduled posts check...');
      await executeScheduledPosts(bot, currentTime);
      console.log('SCHEDULING: Scheduled posts check completed successfully');
    } catch (scheduleError) {
      console.error('SCHEDULING: Error checking scheduled posts:', scheduleError);
      if (scheduleError instanceof Error) {
        console.error('SCHEDULING: Error stack:', scheduleError.stack);
      }
      // Don't fail the webhook if schedule check fails
    }

    // Process the update if it contains a message or callback query
    if (update.message) {
      // Check if the message is from an admin
      const userId = update.message.from?.id;
      console.log(`Message from user ID: ${userId}`);
      console.log(`Admin ID from env: ${process.env.ADMIN_USER_ID}`);
      console.log(`Is admin check result: ${isAdmin(userId)}`);
      
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
      
      // Test channel storage directly
      if (update.message.text?.includes('/add_channel')) {
        const parts = update.message.text.split(' ');
        if (parts.length >= 2) {
          const channelId = parts[1].trim();
          console.log(`Directly adding channel: ${channelId}`);
          await addChannel(channelId);
        }
      }
      
      // Check current storage state
      const currentChannels = await loadChannels();
      console.log('Current stored channels:', await currentChannels);
      
      // Handle the message
      console.log('Processing message from admin user');
      await handleMessage(update.message);
      
      // Check if storage changed
      const updatedChannels = await loadChannels();
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
    } else if (update.callback_query) {
      // Handle callback queries (inline keyboard button presses)
      const userId = update.callback_query.from?.id;
      console.log(`Callback query from user ID: ${userId}`);
      
      if (!isAdmin(userId)) {
        console.log(`Unauthorized callback query from user ${userId}`);
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
      
      // Handle the callback query
      console.log('Processing callback query from admin user');
      await handleCallbackQuery(update.callback_query);
      
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
  
  // Log all environment variables (without values for security)
  console.log('Available env vars:', Object.keys(process.env).join(', '));
  
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
  const currentChannels = await loadChannels();
  console.log('Current stored channels:', currentChannels);
  
  console.log('Valid webhook GET request - endpoint is active');
  return NextResponse.json(
    { 
      status: 'Telegram webhook endpoint is active', 
      bot: process.env.BOT_USERNAME,
      channels: currentChannels.length,
      env: {
        isVercel: process.env.VERCEL === '1',
        hasAdminId: Boolean(process.env.ADMIN_USER_ID),
        hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        hasWebhookSecret: Boolean(process.env.WEBHOOK_SECRET)
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
