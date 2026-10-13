import type { DB } from "../../../db/connection.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpAccount } from "../../modules/records/slp-storage-model.js";
import type { SlurpMessage } from "../../data/slp-storage.js";
import type { SlurpRapport } from "../../modules/messages/slp-rapport.js";
import type { SlurpDmPolicy } from "../../modules/messages/slp-messaging.js";
import type { SlurpThreadNote } from "../../modules/messages/slp-thread-notes.js";
import type { SlurpCreatorState, SlurpThreadState } from "../../modules/creators/slp-creator-state.js";
import type { resolveSlurpCreatorAvailability } from "../../modules/creators/slp-creator-schedule-context.js";
import type { SlurpModelWorkerContext } from "../../base/model/slp-model-worker.js";
import type { createConnectionsStorage } from "../../../services/storage/connections.storage.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlurpMessagePromptInput = {
  db: DB;
  // A `SlurpAccount`, not a bare `SlpAccount`: resolving the creator's Engine source for the
  // schedule needs the source columns, and only the Slurp account carries them.
  creator: SlurpAccount;
  viewer: SlpAccount;
  history: SlurpMessage[];
  rapport: SlurpRapport;
  subscribed: boolean;
  dmPolicy: SlurpDmPolicy;
  isRequest: boolean;
  /** Stored conversation mood and when it was last written, so silence can heal it first. */
  mood?: number;
  moodUpdatedAt?: string | null;
  /** What the creator already knows about this fan, beyond the last sixteen turns. */
  /** The thread this reply belongs to, so its own private notes can reach only this reply. */
  threadId?: string | null;
  notes?: SlurpThreadNote[];
  threadState?: SlurpThreadState;
  creatorState?: SlurpCreatorState;
  /** What kind of day the creator is having, already phrased. */
  dayVibe?: string | null;
  coolingOff?: boolean;
  strikes?: number;
  connection: GenerationConnection;
  debugMode?: boolean;
  /** Extra instruction for scheduled or otherwise specialized replies. */
  generationGuidance?: string;
  /** Scheduled follow-ups are background; direct replies default to present. */
  workerContext?: SlurpModelWorkerContext;
  /** A player pressed Force reply now: no budget setting, cap or mode may swallow that press. */
  skipBudgetCap?: boolean;
  /** The player is waiting on this answer: it neither checks nor spends the hourly and daily caps. */
  playerSend?: boolean;
  /**
   * The availability the reply operation already paced this reply by. Recomputing it here from the
   * schedule alone ignored an open conversation window, so an instant reply was told "you are not free".
   */
  availability?: Awaited<ReturnType<typeof resolveSlurpCreatorAvailability>>;
};
