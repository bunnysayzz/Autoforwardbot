import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_USER_ID;
const vercelUrl = process.env.VERCEL_URL;
const customDomain = process.env.CUSTOM_DOMAIN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN must be set in .env.local');
  process.exit(1);
}

if (!adminId) {
  console.warn('ADMIN_USER_ID is not set. You will not receive admin notifications.');
}

const bot = new TelegramBot(token);

async function setup() {
  try {
    // Get bot info
    const me = await bot.getMe();
    console.log(`Bot Information:`);
    console.log(`- Username: @${me.username}`);
    console.log(`- Name: ${me.first_name}`);
    console.log(`- ID: ${me.id}`);

    // Determine webhook URL
    let webhookUrl: string | null = null;
    
    if (customDomain) {
      webhookUrl = `https://${customDomain}/api/telegram/webhook`;
    } else if (vercelUrl) {
      webhookUrl = `https://${vercelUrl}/api/telegram/webhook`;
    }

    if (webhookUrl) {
      // Set commands
      await bot.setMyCommands([
        { command: 'channel', description: 'List all channels where the bot can forward messages' }
      ]);
      console.log('Bot commands set successfully.');

      // Set webhook
      await bot.setWebHook(webhookUrl);
      console.log(`✅ Webhook set to: ${webhookUrl}`);

      // Verify webhook
      const webhookInfo = await bot.getWebHookInfo();
      console.log('Webhook Info:');
      console.log(`- URL: ${webhookInfo.url}`);
      console.log(`- Has Custom Certificate: ${webhookInfo.has_custom_certificate}`);
      console.log(`- Pending Updates: ${webhookInfo.pending_update_count}`);
      
      if (webhookInfo.last_error_date) {
        const date = new Date(webhookInfo.last_error_date * 1000);
        console.log(`⚠️ Last Error: ${webhookInfo.last_error_message} (${date.toISOString()})`);
      }
    } else {
      console.log('No deployment URL found (VERCEL_URL or CUSTOM_DOMAIN).');
      console.log('For local development:');
      console.log('1. Use a tunnel like ngrok: npx ngrok http 3000');
      console.log('2. Set the webhook manually:');
      console.log(`   curl "https://api.telegram.org/bot${token}/setWebhook?url=YOUR_TUNNEL_URL/api/telegram/webhook"`);
      console.log('Or run the bot in polling mode with: npm run dev');
    }

    // Send notification to admin
    if (adminId) {
      await bot.sendMessage(adminId, 
        `🤖 Bot setup complete!\n\n${
          webhookUrl ? `Webhook set to:\n${webhookUrl}` : 'Running in local development mode.'
        }\n\nForward any message to me and I'll repost it to all configured channels.\n\nUse /channel to see the list of channels.`
      );
      console.log('✅ Startup message sent to admin.');
    }
  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  }
}

setup();
