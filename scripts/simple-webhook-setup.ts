import * as dotenv from 'dotenv';
import * as fs from 'fs';
import axios from 'axios';

// Check if .env.local exists
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const productionDomain = 'autoforwarderbot-nine.vercel.app';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined');
  process.exit(1);
}

async function setupSimpleWebhook() {
  try {
    console.log('🔧 Setting up simple webhook...');
    
    // Check current webhook
    const webhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    let webhookInfo = await axios.get(webhookInfoUrl);
    console.log('📋 Current webhook:', webhookInfo.data.result);
    
    // Delete existing webhook
    console.log('🗑️ Deleting existing webhook...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
    await axios.post(deleteUrl, { drop_pending_updates: true });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Set new webhook (without secret in URL)
    const webhookUrl = `https://${productionDomain}/api/telegram/webhook`;
    console.log(`🔗 Setting webhook to: ${webhookUrl}`);
    
    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await axios.post(setWebhookUrl, {
      url: webhookUrl,
      allowed_updates: [
        'message', 
        'edited_message', 
        'channel_post', 
        'edited_channel_post',
        'callback_query'
      ],
      drop_pending_updates: true,
      max_connections: 40
    });
    
    console.log('📤 Webhook response:', response.data);
    
    if (!response.data.ok) {
      throw new Error(`Failed: ${response.data.description}`);
    }
    
    // Wait for Telegram to update
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify
    webhookInfo = await axios.get(webhookInfoUrl);
    console.log('🔍 Updated webhook:', webhookInfo.data.result);
    
    if (webhookInfo.data.result.url === webhookUrl) {
      console.log('✅ Webhook successfully configured!');
      
      // Test the endpoint
      console.log('🧪 Testing endpoint...');
      const testResponse = await axios.get(`https://${productionDomain}/`);
      console.log('✅ Vercel app is accessible');
      
      // Set bot commands
      console.log('⚙️ Setting bot commands...');
      const commandsUrl = `https://api.telegram.org/bot${token}/setMyCommands`;
      await axios.post(commandsUrl, {
        commands: [
          { command: 'start', description: 'Start the bot and get welcome message' },
          { command: 'schedule', description: 'Manage post scheduling system' },
          { command: 'manage_posts', description: 'Add or manage saved posts for scheduling' },
          { command: 'my_schedules', description: 'View and manage your active schedules' },
          { command: 'channel', description: 'Show all stored channels' },
          { command: 'footer', description: 'Set a footer text' },
          { command: 'wakedb', description: 'Wake up database (admin)' },
          { command: 'dbstatus', description: 'Check database status (admin)' }
        ]
      });
      console.log('✅ Bot commands updated');
      
      console.log('\n🎉 Webhook setup completed!');
      console.log(`📱 Your bot is now live at: https://t.me/${process.env.BOT_USERNAME || 'your_bot_username'}`);
      console.log('📝 Next: Make sure WEBHOOK_SECRET is set in Vercel environment variables');
      
    } else {
      console.log('⚠️ Webhook URL mismatch - this is normal, Telegram may take time to update');
      console.log('🔄 Try checking again in a few minutes');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

setupSimpleWebhook(); 