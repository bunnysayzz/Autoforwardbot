import { DataAPIClient } from "@datastax/astra-db-ts";

const ASTRA_DB_URL = process.env.ASTRA_DB || "";
const ASTRA_DB_TOKEN = process.env.TOKEN || "";

if (!ASTRA_DB_URL || !ASTRA_DB_TOKEN) {
  throw new Error(
    "ASTRA_DB and TOKEN are not set in the environment variables"
  );
}

// Initialize the client and database connection
const client = new DataAPIClient(ASTRA_DB_TOKEN);
export const db = client.db(ASTRA_DB_URL);

// Keep track of the last activity time
let lastActivityTime = Date.now();

// Function to perform a simple ping to keep the connection alive
const keepAlive = async () => {
  try {
    // Perform a simple operation to keep the connection active
    await db.command({ findCollections: {} });
    lastActivityTime = Date.now();
    console.log('Astra DB keep-alive ping successful');
  } catch (error) {
    console.error('Astra DB keep-alive ping failed:', error);
  }
};

// Set up a keep-alive interval (runs every 40 hours to stay under the 48-hour pause threshold)
const KEEP_ALIVE_INTERVAL = 40 * 60 * 60 * 1000; // 40 hours
let keepAliveInterval: NodeJS.Timeout | null = null;

// Function to start the keep-alive mechanism
export const startKeepAlive = () => {
  if (keepAliveInterval) return; // Already running
  
  // Initial ping
  keepAlive();
  
  // Set up interval for subsequent pings
  keepAliveInterval = setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
  console.log('Astra DB keep-alive mechanism started');
};

// Function to stop the keep-alive mechanism
export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('Astra DB keep-alive mechanism stopped');
  }
};

// Start the keep-alive mechanism when the module loads
startKeepAlive();

// Clean up on process exit
process.on('SIGINT', () => {
  stopKeepAlive();
  process.exit(0);
});

// Get a collection with activity tracking
export const getCollection = async (collectionName: string) => {
  // Update last activity time
  lastActivityTime = Date.now();
  return db.collection(collectionName);
};

export default {
  db,
  getCollection,
  startKeepAlive,
  stopKeepAlive
};
