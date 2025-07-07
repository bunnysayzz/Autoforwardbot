# Telegram Autoforward Bot

A Next.js application that runs a Telegram bot for auto-forwarding messages to multiple channels.

## Features

- Automatically forwards messages to configured Telegram channels
- **Auto-discovers channels** where the bot has admin rights (no need to manually specify channel IDs)
- Works with text, images, videos, and albums
- Command `/channel` to list all channels where the bot can forward to
- Runs locally with `npm run dev`
- Designed to be deployed on Vercel

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

This will start both the Next.js server and the Telegram bot in polling mode.

## Channel Auto-Discovery

By default, the bot will automatically discover and forward messages to **all** channels where it has admin rights. This saves you from having to manually specify channel IDs.

If you prefer to manually specify channels:
1. Set `USE_MANUAL_CHANNELS=true` in your `.env.local` file
2. Specify channel IDs in the `FORWARD_CHANNEL_IDS` variable (comma-separated)

## Usage

1. Start the bot with `npm run dev`
2. The bot will send a welcome message to the admin (you) when it starts
3. Forward any message to the bot, and it will automatically forward it to all channels where it has admin rights
4. Use `/channel` to see the list of channels where messages will be forwarded

## Troubleshooting

If you encounter issues:

1. Verify you've created a `.env.local` file with the correct values
   ```
   cat .env.local  # Check if the file exists and has correct values
   ```

2. Run the health check script to identify problems:
   ```
   npm run health-check
   ```
   
3. Make sure:
   - Your bot token is valid
   - You've started a conversation with your bot
   - Your Telegram user ID is correct
   - The bot has admin rights in all channels you want to forward to

## Deployment

To deploy to Vercel:

1. Push your code to a Git repository
2. Create a new project on Vercel linked to your repository
3. Add the environment variables from your `.env.local` file to Vercel's environment settings
4. Deploy

Note: When deployed to Vercel, the bot will use webhooks instead of polling.

## How It Works

This bot uses a **webhook** to receive updates from Telegram, which is the most efficient method for serverless environments like Vercel. Polling is not used as it requires a long-running process, which is not suitable for serverless functions.

The main logic is located in `app/api/telegram/webhook/route.ts`. It handles all incoming messages and commands.
