import * as dotenv from 'dotenv';
import * as fs from 'fs';
import axios from 'axios';
import * as crypto from 'crypto';

// Check if .env.local exists
if (fs.existsSync('.env.local')) {
  // Load environment variables from .env.local
  dotenv.config({ path: '.env.local' });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const productionDomain = 'autoforwarderbot-nine.vercel.app';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined in the environment variables');
  process.exit(1);
}

// Generate a secure webhook secret if not provided
const webhookSecret = process.env.WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');

async function setupProductionWebhook() {
  try {
    console.log('🔧 Setting up webhook for production deployment...');
    console.log(`📡 Domain: ${productionDomain}`);
    
    // First check if there's an existing webhook
    const getWebhookUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const webhookInfo = await axios.get(getWebhookUrl);
    
    console.log('📋 Current webhook info:', webhookInfo.data.result);
    
    // Delete any existing webhook first
    if (webhookInfo.data.result.url) {
      console.log('🗑️ Deleting existing webhook...');
      const deleteWebhookUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
      await axios.post(deleteWebhookUrl, { drop_pending_updates: true });
      console.log('✅ Existing webhook deleted');
    }
    
    // Set up the new webhook
    const webhookUrl = `https://${productionDomain}/api/telegram/webhook?secret=${webhookSecret}`;
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await axios.post(setWebhookUrl, {
      url: webhookUrl,
      allowed_updates: [
        'message', 
        'edited_message', 
        'channel_post', 
        'edited_channel_post',
        'callback_query' // Added for inline keyboard support
      ],
      drop_pending_updates: true,
      max_connections: 100
    });
    
    console.log('📤 Webhook setup response:', response.data);
    
    if (!response.data.ok) {
      throw new Error(`Webhook setup failed: ${response.data.description}`);
    }
    
    // Wait a moment for the webhook to be set
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the webhook was set correctly
    const verifyWebhookInfo = await axios.get(getWebhookUrl);
    console.log('🔍 New webhook info:', verifyWebhookInfo.data.result);
    
    if (verifyWebhookInfo.data.result.url === webhookUrl) {
      console.log('✅ Webhook successfully set up!');
      console.log('🔐 Webhook secret:', webhookSecret);
      
      // Test the webhook endpoint
      console.log('🧪 Testing webhook endpoint...');
      try {
        const testResponse = await axios.get(`https://${productionDomain}/api/telegram/webhook?secret=${webhookSecret}`, {
          timeout: 10000
        });
        console.log('✅ Webhook endpoint is accessible');
      } catch (testError) {
        console.log('⚠️ Webhook endpoint test failed, but this might be expected for GET requests');
      }
      
      // Set up bot commands for production
      console.log('⚙️ Setting up bot commands...');
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
          { command: 'trigger_posts', description: 'Manually trigger scheduled posts (admin only)' },
          { command: 'wakedb', description: 'Wake up the database if it\'s sleeping (admin only)' },
          { command: 'dbstatus', description: 'Check database health status (admin only)' }
        ]
      });
      
      if (commandsResponse.data.ok) {
        console.log('✅ Bot commands set up successfully');
      } else {
        console.log('⚠️ Failed to set bot commands:', commandsResponse.data.description);
      }
      
      console.log('\n🎉 Production webhook setup completed!');
      console.log('📝 Next steps:');
      console.log('1. Add this WEBHOOK_SECRET to your Vercel environment variables:');
      console.log(`   WEBHOOK_SECRET=${webhookSecret}`);
      console.log('2. Redeploy your Vercel app to use the new secret');
      console.log('3. Test your bot by sending a message');
      
    } else {
      console.error('❌ Webhook verification failed');
      console.error('Expected:', webhookUrl);
      console.error('Got:', verifyWebhookInfo.data.result.url);
    }
  } catch (error) {
    console.error('❌ Error setting up webhook:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

setupProductionWebhook(); 