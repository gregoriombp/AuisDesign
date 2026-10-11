import { dataSignature } from "../store";

// Cheap polling for the client: returns a signature that changes when the data
// files change (the app OR a skill wrote).
async function handleGET() {
  return Response.json({ signature: await dataSignature() });
}

export const GET = handleGET;
