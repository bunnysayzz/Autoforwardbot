import TelegramBot, { InlineKeyboardMarkup } from 'node-telegram-bot-api';

/**
 * Main menu keyboard
 */
export function createMainMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📨 Send Now',
          callback_data: 'sendnow_mode'
        },
        {
          text: '⏰ Schedule Posts',
          callback_data: 'schedule_menu'
        }
      ],
      [
        {
          text: '📝 Manage Posts',
          callback_data: 'manage_posts'
        },
        {
          text: '📋 My Schedules',
          callback_data: 'my_schedules'
        }
      ],
      [
        {
          text: '🔧 Channel Settings',
          callback_data: 'channel_settings'
        },
        {
          text: '⚙️ Bot Settings',
          callback_data: 'bot_settings'
        }
      ],
      [
        {
          text: '📊 Database Status',
          callback_data: 'db_status'
        },
        {
          text: '❓ Help',
          callback_data: 'help_menu'
        }
      ]
    ]
  };
}

/**
 * Send Now menu
 */
export function createSendNowMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📤 Send Next Message',
          callback_data: 'sendnow_ready'
        }
      ],
      [
        {
          text: '📋 Send from Saved Posts',
          callback_data: 'sendnow_saved'
        }
      ],
      [
        {
          text: '🔙 Back to Main Menu',
          callback_data: 'main_menu'
        }
      ]
    ]
  };
}

/**
 * Channel settings menu
 */
export function createChannelMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📋 View Channels',
          callback_data: 'view_channels'
        },
        {
          text: '➕ Add Channel',
          callback_data: 'add_channel'
        }
      ],
      [
        {
          text: '➖ Remove Channel',
          callback_data: 'remove_channel'
        },
        {
          text: '🔄 Refresh Channels',
          callback_data: 'refresh_channels'
        }
      ],
      [
        {
          text: '🔙 Back to Main Menu',
          callback_data: 'main_menu'
        }
      ]
    ]
  };
}

/**
 * Bot settings menu
 */
export function createBotSettingsMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📝 Set Footer',
          callback_data: 'set_footer'
        },
        {
          text: '🗑️ Clear Footer',
          callback_data: 'clear_footer'
        }
      ],
      [
        {
          text: '🔄 Wake Database',
          callback_data: 'wake_db'
        },
        {
          text: '🧪 Test Posts',
          callback_data: 'trigger_test'
        }
      ],
      [
        {
          text: '🔙 Back to Main Menu',
          callback_data: 'main_menu'
        }
      ]
    ]
  };
}

/**
 * Help menu
 */
export function createHelpMenu(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '📨 How to Send Posts',
          callback_data: 'help_sending'
        },
        {
          text: '⏰ How to Schedule',
          callback_data: 'help_scheduling'
        }
      ],
      [
        {
          text: '🔧 Channel Setup',
          callback_data: 'help_channels'
        },
        {
          text: '🤖 Commands List',
          callback_data: 'help_commands'
        }
      ],
      [
        {
          text: '🔙 Back to Main Menu',
          callback_data: 'main_menu'
        }
      ]
    ]
  };
}

/**
 * Get help text for different topics
 */
export function getHelpText(topic: string): string {
  switch (topic) {
    case 'sending':
      return `📨 **How to Send Posts**

1. Click "📨 Send Now" from main menu
2. Choose "📤 Send Next Message"  
3. Send your content (text, photo, video, etc.)
4. It will be forwarded to all channels immediately

**Types supported:**
• Text messages
• Photos with captions
• Videos with captions  
• Documents
• Audio files
• Voice messages
• GIFs/animations`;

    case 'scheduling':
      return `⏰ **How to Schedule Posts**

1. Click "⏰ Schedule Posts" from main menu
2. Follow the setup wizard:
   - Set times (e.g., 9:30 AM, 6:00 PM)
   - Choose how many posts per time
   - Select which saved posts to use
3. Your posts will be sent automatically!

**Time formats supported:**
• 9:30 or 09:30 (24-hour)
• 9:30 AM or 2:15 PM  
• 9 AM or 2 PM
• 0930 or 1415`;

    case 'channels':
      return `🔧 **Channel Setup**

1. Add your bot as admin to channels
2. Give these permissions:
   - Post messages
   - Edit messages  
   - Delete messages
3. Use "🔧 Channel Settings" → "➕ Add Channel"
4. Enter channel ID (e.g., -1001234567890)

**Finding Channel ID:**
• Forward a message from the channel to @userinfobot
• Or check in channel settings → statistics`;

    case 'commands':
      return `🤖 **Available Commands**

**Main Commands:**
• /start - Show main menu
• /menu - Show main menu  
• /sendnow - Quick send mode
• /help - Show help

**Advanced Commands:**
• /schedule - Scheduling system
• /manage_posts - Manage saved posts
• /my_schedules - View schedules  
• /channel - Channel management
• /footer - Set footer text
• /dbstatus - Database health
• /wakedb - Wake database`;

    default:
      return 'Help topic not found.';
  }
}

/**
 * Show main menu to user
 */
export async function showMainMenu(bot: TelegramBot, chatId: number, messageText?: string): Promise<void> {
  const text = messageText || `🤖 **Telegram Autoforward Bot**

Welcome! Choose an option from the menu below:

📨 **Send Now** - Forward messages immediately
⏰ **Schedule Posts** - Set up automatic posting
📝 **Manage Posts** - Add/edit saved content
📋 **My Schedules** - View active schedules
🔧 **Channel Settings** - Manage channels
⚙️ **Bot Settings** - Configure bot options

Connected to **${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}** mode`;

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: createMainMenu()
    });
  } catch (error) {
    console.error('Error showing main menu:', error);
    await bot.sendMessage(chatId, 'Error loading menu. Please try /start again.');
  }
} 