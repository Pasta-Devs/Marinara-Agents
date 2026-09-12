import assert from "node:assert/strict";
import { enqueueSlurpFinancial } from "../packages/slurp2/src/engine/packages/server/src/services/storage/slurp-financial-queue.js";

const sharedDb = {} as Parameters<typeof enqueueSlurpFinancial>[0];
const order: number[] = [];

async function main(): Promise<void> {
  await Promise.all([
    enqueueSlurpFinancial(sharedDb, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(1);
    }),
    enqueueSlurpFinancial(sharedDb, async () => {
      order.push(2);
    }),
  ]);
  assert.deepEqual(order, [1, 2], "storage instances sharing a DB must serialize financial operations");
  console.log("slurp financial queue regression passed");
}

void main();
