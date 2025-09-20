import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import bot from '../lib/telegram';
import { isAdmin, getAdminChannels, addChannelHint } from '../lib/telegram';
import { loadChannels, removeChannel, loadFooter, saveFooter, clearFooter } from '../lib/storage';
import {
  handleScheduleCommand,
  handleManagePostsCommand,
  handleMySchedulesCommand,
  handleSchedulingCallback,
  handleSchedulingMessage
} from '../lib/scheduling';
import { startScheduler, triggerScheduledPosts } from '../lib/scheduler';
import { 
  showMainMenu, 
  createSendNowMenu, 
  createChannelMenu, 
  createBotSettingsMenu, 
  createHelpMenu, 
  getHelpText 
} from '../lib/menu-system';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!ADMIN_USER_ID) {
  throw new Error('ADMIN_USER_ID is not defined in the environment variables');
}

/**
 * Forward a message to all admin channels
 */
async function forwardMessage(bot: TelegramBot, message: Message, chatId: number): Promise<void> {
  console.log('Forwarding message to channels...');
  
  try {
    const channels = await getAdminChannels();
    const footer = await loadFooter();
    
    if (channels.length === 0) {
      await bot.sendMessage(chatId, '❌ No channels configured for forwarding.');
      return;
    }

    let successCount = 0;
    let failedChannels: string[] = [];

    for (const channel of channels) {
      try {
        // Forward the message based on its type
        if (message.text) {
          const messageText = footer ? `${message.text}\n\n${footer}` : message.text;
          await bot.sendMessage(channel.id, messageText);
        } else if (message.photo) {
          const caption = message.caption || '';
          const finalCaption = footer ? `${caption}\n\n${footer}` : caption;
          const photo = message.photo[message.photo.length - 1]; // Get the highest quality photo
          await bot.sendPhoto(channel.id, photo.file_id, { caption: finalCaption });
        } else if (message.video) {
          const caption = message.caption || '';
          const finalCaption = footer ? `${caption}\n\n${footer}` : caption;
          await bot.sendVideo(channel.id, message.video.file_id, { caption: finalCaption });
        } else if (message.document) {
          const caption = message.caption || '';
          const finalCaption = footer ? `${caption}\n\n${footer}` : caption;
          await bot.sendDocument(channel.id, message.document.file_id, { caption: finalCaption });
        } else if (message.audio) {
          const caption = message.caption || '';
          const finalCaption = footer ? `${caption}\n\n${footer}` : caption;
          await bot.sendAudio(channel.id, message.audio.file_id, { caption: finalCaption });
        } else if (message.voice) {
          await bot.sendVoice(channel.id, message.voice.file_id);
          if (footer) {
            await bot.sendMessage(channel.id, footer);
          }
        } else if (message.animation) {
          const caption = message.caption || '';
          const finalCaption = footer ? `${caption}\n\n${footer}` : caption;
          await bot.sendAnimation(channel.id, message.animation.file_id, { caption: finalCaption });
        } else {
          console.log('Unsupported message type, skipping...');
          continue;
        }
        
        successCount++;
      } catch (error) {
        console.error(`Failed to forward message to channel ${channel.id}:`, error);
        failedChannels.push(channel.title || channel.username || String(channel.id));
      }
    }

    // Send success/failure summary
    let resultMessage = `✅ Message forwarded to ${successCount} channel(s).`;
    if (failedChannels.length > 0) {
      resultMessage += `\n❌ Failed to forward to: ${failedChannels.join(', ')}`;
    }
    
    await bot.sendMessage(chatId, resultMessage);
  } catch (error) {
    console.error('Error during forwarding:', error);
    await bot.sendMessage(chatId, `Error during forwarding: ${(error as Error).message}`);
  }
}

// Set up the commands that will be shown in the bot menu
export async function setupBotCommands() {
  try {
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot and get welcome message' },
      { command: 'channel', description: 'Show all stored channels with their admin status' },
      { command: 'add_channel', description: 'Add a channel to the forwarding list (use with channel ID)' },
      { command: 'remove_channel', description: 'Remove a channel from the forwarding list (use with channel ID)' },
      { command: 'footer', description: 'Set a footer text to append to all forwarded messages' },
      { command: 'clearfooter', description: 'Clear the current footer' },
              { command: 'schedule', description: 'Manage post scheduling system (IST timezone)' },
        { command: 'manage_posts', description: 'Add or manage saved posts for scheduling' },
        { command: 'my_schedules', description: 'View and manage your active schedules' },
        { command: 'trigger_posts', description: 'Manually trigger scheduled posts (admin only)' },
        { command: 'time', description: 'Check current IST and UTC time' },
        { command: 'sendnow', description: 'Forward messages immediately' },
        { command: 'menu', description: 'Show main menu with options' },
        { command: 'help', description: 'Show help and instructions' }
    ]);
    console.log('Bot commands have been set up successfully');
  } catch (error) {
    console.error('Error setting up bot commands:', error);
  }
}

// Flags to track user states
let awaitingFooter = false;
let awaitingSendNow = false;
let awaitingChannelAdd = false;
let awaitingChannelRemove = false;

export async function handleMessage(message: Message) {
  const chatId = message.chat.id;
  const userId = message.from?.id;

  if (!isAdmin(userId)) {
    await bot.sendMessage(chatId, 'You are not authorized to use this bot.');
    console.log(`Unauthorized access attempt by user ${userId}`);
    return;
  }

  // Check if this message should be handled by the scheduling system
  const isSchedulingHandled = await handleSchedulingMessage(bot, message);
  if (isSchedulingHandled) {
    return;
  }

  // Handle /start or /menu command
  if (message.text?.startsWith('/start') || message.text?.startsWith('/menu')) {
    try {
      await showMainMenu(bot, chatId);
    } catch (error) {
      console.error('Error showing main menu:', error);
      await bot.sendMessage(chatId, `Error: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /sendnow command
  if (message.text?.startsWith('/sendnow')) {
    try {
      awaitingSendNow = true;
      await bot.sendMessage(chatId, 
        '📤 **Send Now Mode**\n\n' +
        'Send me any content (text, photo, video, document, etc.) and I\'ll forward it to all your channels immediately.\n\n' +
        '✋ Send /cancel to exit send mode.',
        { 
          parse_mode: 'Markdown',
          reply_markup: createSendNowMenu()
        }
      );
    } catch (error) {
      console.error('Error in sendnow command:', error);
      await bot.sendMessage(chatId, `Error: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /help command
  if (message.text?.startsWith('/help')) {
    try {
      await bot.sendMessage(chatId, getHelpText('commands'), {
        parse_mode: 'Markdown',
        reply_markup: createHelpMenu()
      });
    } catch (error) {
      console.error('Error showing help:', error);
      await bot.sendMessage(chatId, `Error: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /channel command
  if (message.text?.startsWith('/channel')) {
    try {
      const storedChannels = await loadChannels();
      if (storedChannels.length > 0) {
        // Get chat info for each stored channel
        const channelDetails = await Promise.all(storedChannels.map(async (id: string) => {
          try {
            const chat = await bot.getChat(id);
            const botMember = await bot.getChatMember(id, (await bot.getMe()).id);
            const status = botMember.status === 'administrator' || botMember.status === 'creator' 
              ? '✅ (admin)' 
              : '❌ (not admin)';
            return `- ${chat.title || chat.username || id} (${id}) ${status}`;
          } catch (error) {
            return `- ${id} (cannot access: ${(error as Error).message})`;
          }
        }));
        
        await bot.sendMessage(
          chatId,
          `Stored channels (${storedChannels.length}):\n\n${channelDetails.join('\n')}\n\nOnly channels with admin rights will be used for forwarding.`
        );
      } else {
        await bot.sendMessage(chatId, 'No channels are currently stored. Use /add_channel to add channels where the bot is an admin.');
      }
    } catch (error) {
      console.error('Error fetching channel details:', error);
      await bot.sendMessage(chatId, `Error fetching channel details: ${(error as Error).message}`);
    }
    return;
  }
  
  // Handle /add_channel command - format: /add_channel -100123456789
  if (message.text?.startsWith('/add_channel')) {
    const parts = message.text.split(' ');
    if (parts.length < 2) {
      await bot.sendMessage(
        chatId,
        'Please provide a channel ID. Format: /add_channel -100123456789'
      );
      return;
    }
    
    const channelId = parts[1].trim();
    if (!channelId.startsWith('-100')) {
      await bot.sendMessage(
        chatId,
        'Invalid channel ID format. Channel IDs typically start with -100. Format: /add_channel -100123456789'
      );
      return;
    }
    
    try {
      // Try to get chat info to validate the channel exists
      const chat = await bot.getChat(channelId);
      
      // Add the channel to storage
      await addChannelHint(channelId);
      
      // Check if bot is admin
      const me = await bot.getMe();
      const botMember = await bot.getChatMember(channelId, me.id);
      
      if (botMember.status === 'administrator' || botMember.status === 'creator') {
        await bot.sendMessage(
          chatId,
          `✅ Channel "${chat.title || chat.username || channelId}" added successfully. The bot has admin rights in this channel.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `⚠️ Channel "${chat.title || chat.username || channelId}" added, but the bot is not an admin. Please add the bot as an admin to the channel.`
        );
      }
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to add channel: ${(error as Error).message}`
      );
    }
    
    return;
  }
  
  // Handle /remove_channel command - format: /remove_channel -100123456789
  if (message.text?.startsWith('/remove_channel')) {
    const parts = message.text.split(' ');
    if (parts.length < 2) {
      await bot.sendMessage(
        chatId,
        'Please provide a channel ID. Format: /remove_channel -100123456789'
      );
      return;
    }
    
    const channelId = parts[1].trim();
    
    try {
      await removeChannel(channelId);
      await bot.sendMessage(
        chatId,
        `✅ Channel ${channelId} has been removed from the forwarding list.`
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to remove channel: ${(error as Error).message}`
      );
    }
    
    return;
  }

  // Handle /footer command
  if (message.text?.startsWith('/footer')) {
    awaitingFooter = true;
    await bot.sendMessage(
      chatId,
      'Please send or forward the text you want to use as footer for all forwarded messages.\n\n' +
      'The footer will be appended to all forwarded messages. Special formatting and clickable links will be preserved.'
    );
    return;
  }

  // Handle /clearfooter command
  if (message.text?.startsWith('/clearfooter')) {
    try {
      await clearFooter();
      await bot.sendMessage(
        chatId,
        '✅ Footer has been cleared successfully. Messages will be forwarded without a footer.'
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        `❌ Failed to clear footer: ${(error as Error).message}`
      );
    }
    return;
  }

  // Handle /schedule command
  if (message.text?.startsWith('/schedule')) {
    await handleScheduleCommand(bot, message);
    return;
  }

  // Handle /manage_posts command
  if (message.text?.startsWith('/manage_posts')) {
    await handleManagePostsCommand(bot, message);
    return;
  }

  // Handle /my_schedules command
  if (message.text?.startsWith('/my_schedules')) {
    await handleMySchedulesCommand(bot, message);
    return;
  }

  // Handle /trigger_posts command (for testing)
  if (message.text?.startsWith('/trigger_posts')) {
    try {
      const { getCurrentTime } = await import('../lib/scheduler');
      const currentIstTime = getCurrentTime();
      const parts = message.text.split(' ');
      const time = parts.length > 1 ? parts[1] : undefined;
      const result = await triggerScheduledPosts(bot, time);
      await bot.sendMessage(chatId, 
        `${result}\n\n` +
        `🕐 **Current IST Time**: ${currentIstTime}\n` +
        `🌍 **Timezone**: Indian Standard Time (UTC+5:30)\n\n` +
        '💡 **Serverless Scheduling Info:**\n' +
        '• Scheduled posts are checked on every bot interaction\n' +
        '• For more reliable scheduling, set up external cron:\n' +
        '• URL: https://autoforwarderbot-nine.vercel.app/api/telegram/cron?secret=97d6d9355d087fa59f7c847f658ec515ee2cbbd820a498825ac974285e1a1344\n' +
        '• Call this URL every minute from cron-job.org or similar service',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await bot.sendMessage(chatId, `❌ Error: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /wakedb command (wake up database)
  if (message.text?.startsWith('/wakedb')) {
    try {
      await bot.sendMessage(chatId, '🔄 Attempting to wake up database...');
      
      const { wakeUpDatabase } = await import('../lib/db-health');
      const awakened = await wakeUpDatabase();
      
      if (awakened) {
        await bot.sendMessage(chatId, '✅ Database is now active!');
      } else {
        await bot.sendMessage(chatId, '❌ Failed to wake up database. Please check your configuration.');
      }
    } catch (error) {
      await bot.sendMessage(chatId, `❌ Error waking database: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /dbstatus command (check database status)
  if (message.text?.startsWith('/dbstatus')) {
    try {
      const { getDatabaseStatus } = await import('../lib/db-health');
      const status = await getDatabaseStatus();
      await bot.sendMessage(chatId, `📊 **Database Status**\n\n${status}`, { parse_mode: 'Markdown' });
    } catch (error) {
      await bot.sendMessage(chatId, `❌ Error checking database status: ${(error as Error).message}`);
    }
    return;
  }

  // Handle /time command (check current IST time)
  if (message.text?.startsWith('/time')) {
    try {
      const { getCurrentTime } = await import('../lib/scheduler');
      const currentIstTime = getCurrentTime();
      const now = new Date();
      const utcTime = now.toISOString().substr(11, 5);
      await bot.sendMessage(chatId, 
        `🕐 **Current Times**\n\n` +
        `🇮🇳 **IST**: ${currentIstTime} (Indian Standard Time)\n` +
        `🌍 **UTC**: ${utcTime} (Coordinated Universal Time)\n\n` +
        `📅 **Date**: ${now.toISOString().substr(0, 10)}\n` +
        `⏰ All schedules use IST time zone`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await bot.sendMessage(chatId, `❌ Error checking time: ${(error as Error).message}`);
    }
    return;
  }

  // Handle cancel command
  if (message.text === '/cancel') {
    awaitingFooter = false;
    awaitingSendNow = false;
    awaitingChannelAdd = false;
    awaitingChannelRemove = false;
    await bot.sendMessage(chatId, '❌ Operation cancelled.');
    await showMainMenu(bot, chatId);
    return;
  }

  // Handle sendnow mode
  if (awaitingSendNow && !message.text?.startsWith('/')) {
    try {
      awaitingSendNow = false;
      await forwardMessage(bot, message, chatId);
      await bot.sendMessage(chatId, 
        '✅ Message forwarded to all channels!\n\nSend another message or use the menu below:', 
        { reply_markup: createSendNowMenu() }
      );
      return;
    } catch (error) {
      console.error('Error in sendnow mode:', error);
      await bot.sendMessage(chatId, `❌ Error forwarding message: ${(error as Error).message}`);
      awaitingSendNow = false;
      return;
    }
  }

  // Handle footer text input if we're awaiting it
  if (awaitingFooter) {
    try {
      // Save the entire message including text and entities to preserve formatting
      let footerText = '';
      
      if (message.text) {
        footerText = message.text;
      } else if (message.caption) {
        footerText = message.caption;
      } else {
        footerText = '';
      }
      
      await saveFooter(footerText);
      
      awaitingFooter = false;
      await bot.sendMessage(
        chatId,
        '✅ Footer has been saved successfully. It will be appended to all forwarded messages.'
      );
      await showMainMenu(bot, chatId);
      return;
    } catch (error) {
      awaitingFooter = false;
      await bot.sendMessage(
        chatId,
        `❌ Failed to save footer: ${(error as Error).message}`
      );
      return;
    }
  }

  // Handle channel add mode
  if (awaitingChannelAdd) {
    if (message.text && (message.text.startsWith('-100') || message.text.startsWith('@'))) {
      try {
        await addChannelHint(message.text.trim());
        awaitingChannelAdd = false;
        await bot.sendMessage(chatId, '✅ Channel added successfully!');
        await showMainMenu(bot, chatId);
      } catch (error) {
        await bot.sendMessage(chatId, `❌ Error adding channel: ${(error as Error).message}`);
      }
    } else {
      await bot.sendMessage(chatId, '❌ Please send a valid channel ID (e.g., -1001234567890) or username (e.g., @channelname)');
    }
    return;
  }

  // Handle channel remove mode
  if (awaitingChannelRemove) {
    if (message.text) {
      try {
        await removeChannel(message.text.trim());
        awaitingChannelRemove = false;
        await bot.sendMessage(chatId, '✅ Channel removed successfully!');
        await showMainMenu(bot, chatId);
      } catch (error) {
        await bot.sendMessage(chatId, `❌ Error removing channel: ${(error as Error).message}`);
      }
    } else {
      await bot.sendMessage(chatId, '❌ Please send a valid channel ID');
    }
    return;
  }

  // If we get here, it's an unrecognized message
  await bot.sendMessage(chatId, 
    '❓ I don\'t understand that command.\n\n' +
    'Use the menu below or send /help for assistance:',
    { reply_markup: createSendNowMenu() }
  );
}

/**
 * Handle callback queries (inline keyboard button presses)
 */
export async function handleCallbackQuery(callbackQuery: CallbackQuery) {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'You are not authorized to use this bot.',
      show_alert: true
    });
    return;
  }
  
  try {
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Handle menu navigation
    switch (data) {
      case 'main_menu':
        await showMainMenu(bot, chatId);
        break;
        
      case 'sendnow_mode':
        awaitingSendNow = true;
        await bot.sendMessage(chatId, 
          '📤 **Send Now Mode Active**\n\n' +
          'Send me any content and I\'ll forward it immediately to all channels.\n\n' +
          '✋ Send /cancel to exit.',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'sendnow_ready':
        awaitingSendNow = true;
        await bot.sendMessage(chatId, 
          '📤 **Ready to Forward**\n\n' +
          'Send your content now...',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'schedule_menu':
        const fakeMessage = { chat: { id: chatId }, from: { id: userId } } as Message;
        await handleScheduleCommand(bot, fakeMessage);
        break;
        
      case 'manage_posts':
        const fakeMessage2 = { chat: { id: chatId }, from: { id: userId } } as Message;
        await handleManagePostsCommand(bot, fakeMessage2);
        break;
        
      case 'my_schedules':
        const fakeMessage3 = { chat: { id: chatId }, from: { id: userId } } as Message;
        await handleMySchedulesCommand(bot, fakeMessage3);
        break;
        
      case 'channel_settings':
        await bot.sendMessage(chatId, 
          '🔧 **Channel Settings**\n\nManage your forwarding channels:',
          { 
            parse_mode: 'Markdown',
            reply_markup: createChannelMenu()
          }
        );
        break;
        
      case 'view_channels':
        const fakeMessage4 = { chat: { id: chatId }, from: { id: userId } } as Message;
        await handleChannelCommand(bot, fakeMessage4);
        break;
        
      case 'add_channel':
        awaitingChannelAdd = true;
        await bot.sendMessage(chatId, 
          '➕ **Add Channel**\n\n' +
          'Send me the channel ID (e.g., -1001234567890) or username (e.g., @channelname)\n\n' +
          '💡 To find channel ID: Forward a message from the channel to @userinfobot\n\n' +
          '✋ Send /cancel to abort.',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'remove_channel':
        awaitingChannelRemove = true;
        await bot.sendMessage(chatId, 
          '➖ **Remove Channel**\n\n' +
          'Send me the channel ID to remove\n\n' +
          '✋ Send /cancel to abort.',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'bot_settings':
        await bot.sendMessage(chatId, 
          '⚙️ **Bot Settings**\n\nConfigure bot options:',
          { 
            parse_mode: 'Markdown',
            reply_markup: createBotSettingsMenu()
          }
        );
        break;
        
      case 'set_footer':
        awaitingFooter = true;
        await bot.sendMessage(chatId, 
          '📝 **Set Footer**\n\n' +
          'Send me the footer text to append to all forwarded messages.\n\n' +
          '✋ Send /cancel to abort.',
          { parse_mode: 'Markdown' }
        );
        break;
        
      case 'clear_footer':
        try {
          await clearFooter();
          await bot.sendMessage(chatId, '✅ Footer cleared successfully!');
          await showMainMenu(bot, chatId);
        } catch (error) {
          await bot.sendMessage(chatId, `❌ Error clearing footer: ${(error as Error).message}`);
        }
        break;
        
      case 'wake_db':
        try {
          const { wakeUpDatabase } = await import('../lib/db-health');
          await bot.sendMessage(chatId, '🔄 Waking up database...');
          const awakened = await wakeUpDatabase();
          await bot.sendMessage(chatId, awakened ? '✅ Database is awake!' : '❌ Failed to wake database');
        } catch (error) {
          await bot.sendMessage(chatId, `❌ Error: ${(error as Error).message}`);
        }
        break;
        
      case 'db_status':
        try {
          const { getDatabaseStatus } = await import('../lib/db-health');
          const status = await getDatabaseStatus();
          await bot.sendMessage(chatId, `📊 **Database Status**\n\n${status}`, { parse_mode: 'Markdown' });
        } catch (error) {
          await bot.sendMessage(chatId, `❌ Error: ${(error as Error).message}`);
        }
        break;
        
      case 'help_menu':
        await bot.sendMessage(chatId, getHelpText('commands'), {
          parse_mode: 'Markdown',
          reply_markup: createHelpMenu()
        });
        break;
        
      case 'help_sending':
        await bot.sendMessage(chatId, getHelpText('sending'), { parse_mode: 'Markdown' });
        break;
        
      case 'help_scheduling':
        await bot.sendMessage(chatId, getHelpText('scheduling'), { parse_mode: 'Markdown' });
        break;
        
      case 'help_channels':
        await bot.sendMessage(chatId, getHelpText('channels'), { parse_mode: 'Markdown' });
        break;
        
      case 'help_commands':
        await bot.sendMessage(chatId, getHelpText('commands'), { parse_mode: 'Markdown' });
        break;
        
      default:
        // Let the scheduling system handle it
        await handleSchedulingCallback(bot, callbackQuery);
        break;
    }
    
  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.',
      show_alert: true
    });
  }
}

/**
 * Handle /channel command (moved to separate function)
 */
async function handleChannelCommand(bot: TelegramBot, message: Message): Promise<void> {
  const chatId = message.chat.id;
  
  try {
    const storedChannels = await loadChannels();
    if (storedChannels.length > 0) {
      // Get chat info for each stored channel
      const channelDetails = await Promise.all(storedChannels.map(async (id: string) => {
        try {
          const chat = await bot.getChat(id);
          const botMember = await bot.getChatMember(id, (await bot.getMe()).id);
          const status = botMember.status === 'administrator' || botMember.status === 'creator' 
            ? '✅ (admin)' 
            : '❌ (not admin)';
          return `• ${chat.title || chat.username || id} ${status}`;
        } catch (error) {
          return `• ${id} ❌ (cannot access)`;
        }
      }));
      
      await bot.sendMessage(
        chatId,
        `📋 **Connected Channels (${storedChannels.length})**\n\n${channelDetails.join('\n')}\n\n💡 Only channels with admin rights will receive forwards.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: createChannelMenu()
        }
      );
    } else {
      await bot.sendMessage(chatId, 
        '📋 **No Channels Connected**\n\nUse "➕ Add Channel" to connect your first channel.',
        { 
          parse_mode: 'Markdown',
          reply_markup: createChannelMenu()
        }
      );
    }
  } catch (error) {
    console.error('Error fetching channel details:', error);
    await bot.sendMessage(chatId, `❌ Error fetching channels: ${(error as Error).message}`);
  }
}

/**
 * Initialize the bot and start the scheduler
 */
export async function initializeBot() {
  try {
    console.log('Initializing bot...');
    
    // Set up bot commands
    await setupBotCommands();
    
    // Start the post scheduler
    startScheduler(bot);
    
    console.log('Bot initialized successfully');
  } catch (error) {
    console.error('Error initializing bot:', error);
  }
}
