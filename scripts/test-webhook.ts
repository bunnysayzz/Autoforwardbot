import 'dotenv/config';
import axios from 'axios';

// Get configuration from command line arguments
const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.argv[3] || process.env.WEBHOOK_SECRET;
const vercelUrl = process.argv[4] || process.env.VERCEL_URL || 'autoforward-jade.vercel.app';

// Remove https:// prefix if present
const cleanVercelUrl = vercelUrl.replace(/^https?:\/\//, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined. Please provide it as the first argument.');
  console.error('Usage: npx ts-node scripts/test-webhook.ts <BOT_TOKEN> <WEBHOOK_SECRET> [VERCEL_URL]');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('WEBHOOK_SECRET is not defined. Please provide it as the second argument.');
  console.error('Usage: npx ts-node scripts/test-webhook.ts <BOT_TOKEN> <WEBHOOK_SECRET> [VERCEL_URL]');
  process.exit(1);
}

async function testWebhook() {
  try {
    // 1. Get webhook info
    console.log('1. Checking current webhook info...');
    const getWebhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const infoResponse = await axios.get(getWebhookInfoUrl);
    console.log('Current webhook info:', infoResponse.data);
    
    // 2. Test the webhook endpoint directly
    console.log('\n2. Testing webhook endpoint directly...');
    const webhookUrl = `https://${cleanVercelUrl}/api/telegram/webhook?secret=${webhookSecret}`;
    try {
      const endpointResponse = await axios.get(webhookUrl);
      console.log('Webhook endpoint response:', endpointResponse.data);
    } catch (error: any) {
      console.error('Error testing webhook endpoint:', error?.message || 'Unknown error');
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
      }
    }
    
    // 3. Send a test message to admin
    console.log('\n3. Sending test message to admin...');
    try {
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId) {
        console.log('ADMIN_USER_ID not set, skipping test message');
      } else {
        const sendMessageUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const messageResponse = await axios.post(sendMessageUrl, {
          chat_id: adminId,
          text: `🤖 Test message from webhook test script.\n\nTime: ${new Date().toISOString()}\nWebhook URL: ${webhookUrl}`
        });
        console.log('Message sent response:', messageResponse.data);
      }
    } catch (error: any) {
      console.error('Error sending test message:', error?.message || 'Unknown error');
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
      }
    }
    
    // 4. Check bot info
    console.log('\n4. Checking bot info...');
    const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
    const meResponse = await axios.get(getMeUrl);
    console.log('Bot info:', meResponse.data);
    
  } catch (error: any) {
    console.error('Error in test script:', error?.message || 'Unknown error');
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
    }
    process.exit(1);
  }
}

testWebhook(); 