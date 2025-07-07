import { NextRequest, NextResponse } from 'next/server';
import { handleMessage } from '../../../../scripts/bot';
import { isAdmin } from '../../../../lib/telegram';
import { Update } from 'node-telegram-bot-api';

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

// The webhook route only receives updates and queues them for processing
export async function POST(request: NextRequest) {
  // Validate the secret token
  if (!validateSecret(request)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook secret' }, { status: 401 });
  }
  
  try {
    const update: Update = await request.json();

    // Process the update if it contains a message
    if (update.message) {
      // Check if the message is from an admin
      const userId = update.message.from?.id;
      
      if (!isAdmin(userId)) {
        console.log(`Unauthorized webhook access from user ${userId}`);
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }
      
      // Handle the message
      await handleMessage(update.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, info: 'Update received but no message to process' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: `Error processing webhook: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// Required for Vercel
export async function GET(request: NextRequest) {
  if (!validateSecret(request)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook secret' }, { status: 401 });
  }
  
  return NextResponse.json({ status: 'Telegram webhook endpoint is active' });
}
