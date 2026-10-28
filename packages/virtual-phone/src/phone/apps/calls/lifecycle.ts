import type { Audience, PhoneEvent, PhoneProcess, PrincipalRef } from "../../system/interaction-model";

export type CallLifecycleState = "placed" | "ringing" | "answered" | "declined" | "missed" | "ended";

export interface CallLifecycleInput {
  callId: string;
  chatId: string;
  phoneId: string;
  mode: "audio" | "video";
  state: CallLifecycleState;
  previousState?: CallLifecycleState;
  initiator: PrincipalRef;
  recipient: PrincipalRef;
  transitionActor?: PrincipalRef;
  owner: PrincipalRef;
  holder?: PrincipalRef;
  source: "user-ui" | "character-command" | "background";
  at: string;
  incomingToPhone: boolean;
}

const participantAudience = (input: CallLifecycleInput): Audience => ({
  kind: "participants",
  principalIds: [input.initiator.id, input.recipient.id],
});

const safeStateSummary = (input: CallLifecycleInput) => {
  const pair = `${input.initiator.name} and ${input.recipient.name}`;
  if (input.state === "placed") return `${input.initiator.name} placed a ${input.mode} call to ${input.recipient.name}`;
  if (input.state === "ringing") return `The ${input.mode} call between ${pair} is ringing`;
  if (input.state === "answered") return `${input.recipient.name} answered the ${input.mode} call from ${input.initiator.name}`;
  if (input.state === "declined") return `The ${input.mode} call between ${pair} was declined`;
  if (input.state === "missed") return `${input.recipient.name} missed the ${input.mode} call from ${input.initiator.name}`;
  return `The ${input.mode} call between ${pair} ended`;
};

export function callLifecycleEvent(input: CallLifecycleInput): PhoneEvent {
  return {
    id: `call-event:${input.callId}:${input.state}`,
    chatId: input.chatId,
    phoneId: input.phoneId,
    appId: "calls",
    verb: `call.${input.state}`,
    actors: {
      actor: input.transitionActor ?? (input.state === "placed" || input.state === "ringing" ? input.initiator : input.recipient),
      ...(input.source === "user-ui" ? { operator: { kind: "user" as const, id: "user" } } : {}),
      owner: input.owner,
      ...(input.holder ? { holder: input.holder } : {}),
    },
    audience: participantAudience(input),
    // Call identities and outcomes belong to the participants. Merely hearing a device ring does
    // not reveal who is calling; that is represented by the separate device.rang event below.
    physicalObserverIds: [],
    canon: "canonical",
    data: { callId: input.callId, mode: input.mode, state: input.state },
    source: { kind: input.source },
    occurredAt: input.at,
    recordedAt: input.at,
    processId: `call:${input.callId}`,
    idempotencyKey: `calls:${input.callId}:${input.state}`,
  };
}

export function callRangEvent(input: CallLifecycleInput): PhoneEvent | null {
  if (input.state !== "ringing" || !input.incomingToPhone) return null;
  return {
    id: `call-event:${input.callId}:device-rang`,
    chatId: input.chatId,
    phoneId: input.phoneId,
    appId: "calls",
    verb: "device.rang",
    actors: {
      actor: { kind: "system", id: "phone-system" },
      owner: input.owner,
      ...(input.holder ? { holder: input.holder } : {}),
    },
    audience: { kind: "private", principalIds: [input.owner.id] },
    physicalObserverIds: input.holder ? [input.holder.id] : [],
    canon: "canonical",
    data: {
      callId: input.callId,
      mode: input.mode,
      promptSummary: `${input.owner.name}'s phone is ringing`,
    },
    source: { kind: input.source === "user-ui" ? "background" : input.source },
    occurredAt: input.at,
    recordedAt: input.at,
    processId: `call:${input.callId}`,
    idempotencyKey: `calls:${input.callId}:device-rang`,
  };
}

export function callLifecycleProcess(input: CallLifecycleInput, sourceEventId: string): PhoneProcess<CallLifecycleState> {
  return {
    id: `call:${input.callId}`,
    chatId: input.chatId,
    phoneId: input.phoneId,
    appId: "calls",
    kind: "call-session",
    state: input.state,
    ...(input.previousState ? { previousState: input.previousState } : {}),
    participants: [input.initiator, input.recipient],
    data: {
      callId: input.callId,
      mode: input.mode,
      promptSummary: safeStateSummary(input),
    },
    createdAt: input.at,
    updatedAt: input.at,
    sourceEventId,
  };
}
