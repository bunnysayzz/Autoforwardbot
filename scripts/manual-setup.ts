import 'dotenv/config';
import axios from 'axios';

// Get configuration from environment variables or command line arguments
const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.argv[3] || process.env.WEBHOOK_SECRET;
const vercelUrl = process.argv[4] || process.env.VERCEL_URL || 'autoforward-jade.vercel.app';

// Remove https:// prefix if present
const cleanVercelUrl = vercelUrl.replace(/^https?:\/\//, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined. Please provide it as the first argument.');
  console.error('Usage: npx ts-node scripts/manual-setup.ts <BOT_TOKEN> <WEBHOOK_SECRET> [VERCEL_URL]');
  process.exit(1);
}

if (!webhookSecret) {
  console.error('WEBHOOK_SECRET is not defined. Please provide it as the second argument.');
  console.error('Usage: npx ts-node scripts/manual-setup.ts <BOT_TOKEN> <WEBHOOK_SECRET> [VERCEL_URL]');
  process.exit(1);
}

async function setupWebhook() {
  try {
    // Construct the webhook URL with the secret
    const webhookUrl = `https://${cleanVercelUrl}/api/telegram/webhook?secret=${webhookSecret}`;
    
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
        { command: 'clearfooter', description: 'Clear the current footer' },
        { command: 'schedule', description: 'Manage post scheduling system' },
        { command: 'manage_posts', description: 'Add or manage saved posts for scheduling' },
        { command: 'my_schedules', description: 'View and manage your active schedules' },
        { command: 'trigger_posts', description: 'Manually trigger scheduled posts (admin only)' }
      ]
    });
    
    console.log('Set commands response:', commandsResponse.data);
    
    // Delete webhook (optional, uncomment if needed)
    // const deleteWebhookUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
    // const deleteResponse = await axios.post(deleteWebhookUrl);
    // console.log('Delete webhook response:', deleteResponse.data);
    
  } catch (error) {
    console.error('Error setting up webhook:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
    }
    process.exit(1);
  }
}

setupWebhook(); 