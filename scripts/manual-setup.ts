import 'dotenv/config';
import axios from 'axios';

// Get configuration from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.WEBHOOK_SECRET;
const vercelUrl = process.env.VERCEL_URL || 'autoforward-jade.vercel.app';

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined in the environment variables');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('WEBHOOK_SECRET is not defined in the environment variables');
  process.exit(1);
}

async function setupWebhook() {
  try {
    // Construct the webhook URL with the secret
    const webhookUrl = `https://${vercelUrl}/api/telegram/webhook?secret=${webhookSecret}`;
    
    console.log(`Setting webhook to: ${webhookUrl}`);
    
    // Set the webhook
    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const setResponse = await axios.post(setWebhookUrl, {
      url: webhookUrl,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"]
    });
    
    console.log('Webhook set response:', setResponse.data);
    
    // Get webhook info
    const getWebhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const infoResponse = await axios.get(getWebhookInfoUrl);
    
    console.log('Webhook info:', infoResponse.data);
    
    // Set bot commands
    const setCommandsUrl = `https://api.telegram.org/bot${token}/setMyCommands`;
    const commandsResponse = await axios.post(setCommandsUrl, {
      commands: [
        { command: 'start', description: 'Start the bot and get welcome message' },
        { command: 'channel', description: 'Show all stored channels with their admin status' },
        { command: 'add_channel', description: 'Add a channel to the forwarding list (use with channel ID)' },
        { command: 'remove_channel', description: 'Remove a channel from the forwarding list (use with channel ID)' },
        { command: 'footer', description: 'Set a footer text to append to all forwarded messages' },
        { command: 'clearfooter', description: 'Clear the current footer' }
      ]
    });
    
    console.log('Set commands response:', commandsResponse.data);
    
  } catch (error) {
    console.error('Error setting up webhook:', error);
    process.exit(1);
  }
}

setupWebhook(); 