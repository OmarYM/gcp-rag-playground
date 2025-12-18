import { PubSub } from "@google-cloud/pubsub";
import { OAuth2Client } from "google-auth-library";
import { AppConfig } from "../config.js";
import { ChunkingStrategy } from "./chunking.js";

export interface IngestionMessagePayload {
  documentId: string;
  userId: string;
  filename: string;
  storageUri: string;
  strategy?: ChunkingStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

export interface PubSubService {
  publishIngestionEvent(payload: IngestionMessagePayload): Promise<string>;
  verifyPushAuthorization(authHeader?: string): Promise<boolean>;
}

export function createPubSubService(cfg: AppConfig): PubSubService {
  let pubsubClient: PubSub | null = null;
  const oauthClient = new OAuth2Client();

  const getClient = () => {
    if (!pubsubClient) {
      pubsubClient = new PubSub({
        ...(cfg.ai.projectId ? { projectId: cfg.ai.projectId } : {}),
      });
    }
    return pubsubClient;
  };

  return {
    async publishIngestionEvent(
      payload: IngestionMessagePayload
    ): Promise<string> {
      const topicName = cfg.ingestion.processingTopic;
      if (!topicName) {
        throw new Error(
          "PROCESSING_TOPIC is not configured. Cannot publish to Pub/Sub."
        );
      }

      const client = getClient();
      const dataBuffer = Buffer.from(JSON.stringify(payload), "utf-8");
      const messageId = await client.topic(topicName).publishMessage({
        data: dataBuffer,
        attributes: {
          documentId: payload.documentId,
          userId: payload.userId,
        },
      });
      return messageId;
    },

    async verifyPushAuthorization(authHeader?: string): Promise<boolean> {
      if (
        cfg.ingestion.allowUnauthenticatedLocalPubsub ||
        cfg.ingestion.pubsubEmulatorHost
      ) {
        return true;
      }

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return false;
      }

      const token = authHeader.slice("Bearer ".length).trim();
      if (!token) return false;

      // Verify Google-signed OIDC token from Pub/Sub push subscription
      const ticket = await oauthClient.verifyIdToken({
        idToken: token,
        ...(cfg.ingestion.pubsubVerificationAudience
          ? { audience: cfg.ingestion.pubsubVerificationAudience }
          : {}),
      });
      const claims = ticket.getPayload();
      if (!claims || !claims.email_verified) {
        return false;
      }

      if (
        cfg.ingestion.pubsubPushServiceAccount &&
        claims.email !== cfg.ingestion.pubsubPushServiceAccount
      ) {
        return false;
      }

      return true;
    },
  };
}
