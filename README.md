# Telegram Autoforward Bot

A Next.js application that runs a Telegram bot for auto-forwarding messages to multiple channels with advanced scheduling capabilities.

## Features

### Core Features
- Automatically forwards messages to configured Telegram channels
- **Auto-discovers channels** where the bot has admin rights (no need to manually specify channel IDs)
- Works with text, images, videos, and albums
- Command `/channel` to list all channels where the bot can forward to
- Runs locally with `npm run dev`
- Designed to be deployed on Vercel

### 🆕 Scheduling System
- **Automated Post Scheduling**: Schedule posts to be forwarded automatically at specific times
- **Multi-time Support**: Set multiple different times for the same schedule
- **Smart Post Management**: Save and organize posts that can be used for scheduling
- **Random Selection**: Bot randomly selects from your saved posts for variety
- **Flexible Time Formats**: Supports various time formats (9:30, 09:30, 9:30 AM, 1430, etc.)
- **Easy Management**: Full menu system to add, edit, and delete posts and schedules

## Setup

1. Copy the example.env.local file to create a `.env.local` file in the project root:
   ```
   cp example.env.local .env.local
   ```

2. Edit the `.env.local` file with your actual values:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here  # Get from @BotFather
   BOT_USERNAME=your_bot_username_here     # Without @ symbol
   ADMIN_USER_ID=your_telegram_user_id     # Get from @userinfobot
   USE_MANUAL_CHANNELS=false               # Set to true to manually specify channels
   ASTRA_DB=your_astra_db_url              # Your Astra DB URL
   TOKEN=your_astra_db_token               # Your Astra DB token
   ```

3. Add your bot as an admin to the channels where you want to forward messages.
   The bot needs at minimum these permissions:
   - Post messages
   - Edit messages
   - Delete messages

4. Install dependencies:
   ```
   npm install
   ```

5. Run the health check to verify your setup:
   ```
   npm run health-check
   ```

6. Run the development server:
   ```
   npm run dev
   ```

This will start both the Next.js server and the Telegram bot in polling mode with the scheduling system active.

## Commands

### Channel Management
- `/start` - Start the bot and get welcome message
- `/channel` - Show all stored channels with their admin status
- `/add_channel` - Add a channel to the forwarding list (use with channel ID)
- `/remove_channel` - Remove a channel from the forwarding list (use with channel ID)

### 🆕 Scheduling System
- `/schedule` - Open the main scheduling menu
- `/manage_posts` - Add or manage saved posts for scheduling
- `/my_schedules` - View and manage your active schedules
- `/trigger_posts [time]` - Manually trigger scheduled posts (for testing)

### Other Commands
- `/footer` - Set a footer text to append to all forwarded messages
- `/clearfooter` - Clear the current footer

## How the Scheduling System Works

### 1. Save Posts
Use `/manage_posts` to save content that you want to schedule:
- Text messages
- Photos with captions
- Videos with captions
- Documents
- Audio files

### 2. Create Schedules
Use `/schedule` to create automated posting schedules:
1. Set one or more times when posts should be sent
2. Choose how many posts to send each time
3. Select which saved posts to include
4. Activate the schedule

### 3. Automatic Posting
The bot runs a scheduler that:
- Checks every minute for active schedules
- At scheduled times, randomly selects the specified number of posts
- Forwards them to all configured channels
- Includes your footer text if set

### Example Workflow
1. Save 10 different posts using `/manage_posts`
2. Create a schedule for 9:00 AM and 6:00 PM
3. Set it to send 2 random posts each time
4. The bot will automatically post 2 random posts at 9 AM and 2 different random posts at 6 PM every day

## Channel Auto-Discovery

By default, the bot will automatically discover and forward messages to **all** channels where it has admin rights. This saves you from having to manually specify channel IDs.

If you prefer to manually specify channels:
1. Set `USE_MANUAL_CHANNELS=true` in your `.env.local` file
2. Specify channel IDs in the `FORWARD_CHANNEL_IDS` variable (comma-separated)

## Usage

### Immediate Forwarding
1. Start the bot with `npm run dev`
2. The bot will send a welcome message to the admin (you) when it starts
3. Forward any message to the bot, and it will immediately forward it to all channels where it has admin rights

### Scheduled Posting
1. Use `/schedule` to access the scheduling system
2. Add posts with `/manage_posts`
3. Create schedules with specific times and post counts
4. The bot will automatically handle the rest!

## Database

The bot uses Astra DB to store:
- Channel configurations
- Footer text
- Scheduled posts
- User schedules
- Conversation states

## Deployment

For production deployment, the bot can run in webhook mode on Vercel. See the webhook setup scripts for configuration.

## Testing

Run the scheduling system test:
```
npm run test-scheduling
```

This will verify that all scheduling components are working correctly.

## Troubleshooting

### Scheduling Issues
- Make sure your Astra DB credentials are correct
- Verify the bot has admin rights in your channels
- Check the console for any error messages
- Use `/trigger_posts` to manually test post forwarding

### General Issues
- Verify your `.env.local` file has all required variables
- Check that the bot token is valid
- Ensure the admin user ID is correct
- Run `npm run health-check` to diagnose issues
