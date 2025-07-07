export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col">
        <h1 className="text-4xl font-bold mb-6">Telegram Autoforward Bot</h1>
        <p className="text-xl mb-4">
          Bot Status: <span className="text-green-500 font-bold">Online</span>
        </p>
        <div className="bg-gray-100 p-4 rounded-md shadow-md max-w-lg w-full">
          <h2 className="text-xl font-semibold mb-2">Connection Info</h2>
          <p className="mb-2">
            This is the home page for the Telegram Autoforward Bot. The bot is configured to forward
            messages between channels with the added footer functionality.
          </p>
          <p className="mb-2">
            To verify webhook connection, visit: <code className="bg-gray-200 px-2 py-1 rounded">/api/telegram/webhook?secret=YOUR_SECRET</code>
          </p>
        </div>
      </div>
    </main>
  );
} 