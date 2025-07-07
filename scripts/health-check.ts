import * as dotenv from 'dotenv';
// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import { getAdminChannels } from '../lib/telegram';

// Check if .env.local exists
const envFileExists = fs.existsSync('.env.local');
if (!envFileExists) {
  console.error('❌ .env.local file not found. Please create one based on example.env.local.');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const adminId = process.env.ADMIN_USER_ID;
const useManualChannels = process.env.USE_MANUAL_CHANNELS === 'true';
const channelIds = process.env.FORWARD_CHANNEL_IDS?.split(',').filter(Boolean) || [];

async function checkBotHealth() {
  console.log('🔍 Starting bot health check...');
  console.log('.env.local file found:', envFileExists ? '✅' : '❌');
  
  // Check environment variables
  console.log('\n📋 Checking environment variables:');
  let hasErrors = false;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing');
    hasErrors = true;
  } else {
    console.log('✅ TELEGRAM_BOT_TOKEN is set');
  }
  
  if (!adminId) {
    console.error('❌ ADMIN_USER_ID is missing');
    hasErrors = true;
  } else {
    console.log('✅ ADMIN_USER_ID is set');
  }
  
  console.log(`✅ Channel mode: ${useManualChannels ? 'MANUAL' : 'AUTO-DISCOVERY'}`);
  
  if (useManualChannels && channelIds.length === 0) {
    console.warn('⚠️ USE_MANUAL_CHANNELS is true but FORWARD_CHANNEL_IDS is empty');
  } else if (useManualChannels) {
    console.log(`✅ FORWARD_CHANNEL_IDS has ${channelIds.length} channels configured`);
  }
  
  if (hasErrors) {
    console.error('\n❌ Environment variable check failed. Please set all required variables in .env.local');
    process.exit(1);
  }
  
  // Check bot connection
  console.log('\n📡 Testing bot connection...');
  const bot = new TelegramBot(token, { polling: false });
  
  try {
    const me = await bot.getMe();
    console.log(`✅ Successfully connected to Telegram API`);
    console.log(`   Bot name: ${me.first_name}`);
    console.log(`   Bot username: @${me.username}`);
    console.log(`   Bot ID: ${me.id}`);

    // Check admin communication
    if (adminId) {
      console.log('\n📨 Testing admin communication...');
      try {
        await bot.sendMessage(adminId, '🔍 Health check test message - please ignore');
        console.log('✅ Successfully sent test message to admin');
      } catch (error) {
        console.error('❌ Failed to send message to admin:', (error as Error).message);
        console.log('   Possible causes:');
        console.log('   - ADMIN_USER_ID may be incorrect');
        console.log('   - Admin may not have started a conversation with the bot');
        console.log('   - Bot may be blocked by admin');
      }
    }
    
    // Check channel permissions using the auto-discovery function
    console.log('\n🔐 Testing channel access...');
    try {
      const adminChannels = await getAdminChannels();
      
      if (adminChannels.length > 0) {
        console.log(`✅ Found ${adminChannels.length} channels where the bot has admin rights:`);
        for (const channel of adminChannels) {
          console.log(`   - ${channel.title || channel.username || channel.id}`);
        }
      } else {
        console.warn('⚠️ No channels found where the bot has admin rights');
        console.log('   Please add the bot as an admin to channels where you want to forward messages');
      }
    } catch (error) {
      console.error('❌ Failed to discover admin channels:', (error as Error).message);
    }
  } catch (error) {
    console.error('❌ Failed to connect to Telegram API:', (error as Error).message);
    console.error('   Please check your TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }
  
  console.log('\n🏁 Health check completed!');
}

checkBotHealth().catch(error => {
  console.error('Unhandled error during health check:', error);
  process.exit(1);
}); 