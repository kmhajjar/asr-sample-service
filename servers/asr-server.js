import Fastify from "fastify";
import { TranscriptMocks } from "../mock-transcripts.js";

const DELAY_MS = 5_000;
const FAILURE_RATE = 1 / 10;
const MAX_REQUESTS = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const addRandomRequestLatency = async () => {
  await sleep(DELAY_MS + Math.random() * DELAY_MS);
};


let currentRequests = 0;

const configureASRServer = async () => {
  const server = Fastify({
    logger: true,
  })


  server.addHook("onRequest", async (request, reply) => {
    if (currentRequests + 1 > MAX_REQUESTS) {
      return reply.code(429).send({error: "Too many requests"});
    }

    currentRequests++;
  });

  ["onResponse", "onRequestAbort"].forEach((hook) => {
    server.addHook(hook, async (request) => {
      currentRequests = Math.max(0, currentRequests - 1);
    });
  });


  /* *
  This would be deployed as its own service
   */
  server.get("/get-asr-output", async function handler(request, reply) {
    const {path} = request.query;

    await addRandomRequestLatency();

    const file = TranscriptMocks.get(path);
    if (!file) {
      return reply.code(404).send({error: "File not found"});
    }

    if (file.shouldError || Math.random() < FAILURE_RATE) {
      return reply.code(500).send({error: "Internal server error"});
    }

    return {path, transcript: file.text};
  });

  try {
    console.log("Starting server..., supported paths:");
    console.log(TranscriptMocks.keys());
    await server.listen({port: 3000});
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
  return server
}

export default configureASRServer;

