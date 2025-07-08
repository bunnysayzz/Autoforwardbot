import { DataAPIClient } from "@datastax/astra-db-ts";

const ASTRA_DB_URL = process.env.ASTRA_DB || "";
const ASTRA_DB_TOKEN = process.env.TOKEN || "";

if (!ASTRA_DB_URL || !ASTRA_DB_TOKEN) {
  throw new Error(
    "ASTRA_DB and TOKEN are not set in the environment variables"
  );
}

const client = new DataAPIClient(ASTRA_DB_TOKEN);
export const db = client.db(ASTRA_DB_URL);

export const getCollection = async (collectionName: string) => {
  return db.collection(collectionName);
};
