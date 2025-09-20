import * as dotenv from 'dotenv';
import * as fs from 'fs';
import axios from 'axios';

// Check if .env.local exists
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const productionDomain = 'autoforwarderbot-nine.vercel.app';
const webhookSecret = '97d6d9355d087fa59f7c847f658ec515ee2cbbd820a498825ac974285e1a1344';

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not defined');
  process.exit(1);
}

async function finalWebhookSetup() {
  try {
    console.log('🔧 Final webhook setup with secret...');
    
    // Delete existing webhook first
    console.log('🗑️ Deleting existing webhook...');
    const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;
    await axios.post(deleteUrl, { drop_pending_updates: true });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Set webhook with secret parameter
    const webhookUrl = `https://${productionDomain}/api/telegram/webhook?secret=${webhookSecret}`;
    console.log(`🔗 Setting final webhook to: ${webhookUrl}`);
    
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
    
    if (response.data.ok) {
      console.log('✅ Final webhook setup completed!');
      
      // Wait and verify
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const webhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
      const webhookInfo = await axios.get(webhookInfoUrl);
      console.log('🔍 Final webhook info:', webhookInfo.data.result);
      
      console.log('\n🎉 Your bot is now fully configured!');
      console.log('📱 Test your bot by sending /start');
      console.log('⏰ All scheduling features are available');
      console.log('🔄 Database keep-alive is active');
      
    } else {
      console.error('❌ Webhook setup failed:', response.data.description);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

finalWebhookSetup(); 