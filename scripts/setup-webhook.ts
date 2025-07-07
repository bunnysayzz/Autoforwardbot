import * as dotenv from 'dotenv';
import * as fs from 'fs';
import axios from 'axios';

// Check if .env.local exists
if (fs.existsSync('.env.local')) {
  // Load environment variables from .env.local
  dotenv.config({ path: '.env.local' });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.WEBHOOK_SECRET;
const vercelDomain = process.env.VERCEL_URL || 'autoforward-jade.vercel.app';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined in the environment variables');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('❌ WEBHOOK_SECRET is not defined in the environment variables');
  process.exit(1);
}

async function setupWebhook() {
  try {
    // First check if there's an existing webhook
    const getWebhookUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const webhookInfo = await axios.get(getWebhookUrl);
    
    console.log('Current webhook info:', webhookInfo.data);
    
    // Delete any existing webhook
    console.log('Deleting existing webhook...');
    const deleteWebhookUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
    await axios.get(deleteWebhookUrl);
    
    // Set up the new webhook
    const webhookUrl = `https://${vercelDomain}/api/telegram/webhook?secret=${webhookSecret}`;
    console.log(`Setting webhook to: ${webhookUrl}`);
    
    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await axios.post(setWebhookUrl, {
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
      drop_pending_updates: true
    });
    
    console.log('Webhook setup response:', response.data);
    
    // Verify the webhook was set correctly
    const verifyWebhookInfo = await axios.get(getWebhookUrl);
    console.log('New webhook info:', verifyWebhookInfo.data);
    
    if (verifyWebhookInfo.data.result.url === webhookUrl) {
      console.log('✅ Webhook successfully set up!');
    } else {
      console.error('❌ Webhook verification failed');
    }
  } catch (error) {
    console.error('Error setting up webhook:', error);
    process.exit(1);
  }
}

setupWebhook(); 