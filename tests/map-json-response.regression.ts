import assert from "node:assert/strict";
import {
  buildSpatialMapJsonRepairMessages,
  classifySpatialMapJsonParseFailure,
  hasIncompleteJsonStructure,
  parseSpatialMapJsonWithRepair,
  spatialMapJsonErrorPayload,
} from "../packages/hierarchical-maps/src/engine/packages/server/src/services/spatial-context/map-json-response";

async function main() {
  const balancedMalformed = `{
  "locations": [
    {
      "name": "The Green Man",
      typeKeyPlaceholder: null,
      "typeKey": "pub"
    }
  ]
}`;

  assert.equal(hasIncompleteJsonStructure(balancedMalformed), false);
  assert.equal(hasIncompleteJsonStructure('{"locations": [{"name": "Harbor"}'), true);
  assert.equal(hasIncompleteJsonStructure('{"description": "unfinished'), true);
  assert.equal(hasIncompleteJsonStructure('{"locations": ]}'), false);
  assert.equal(hasIncompleteJsonStructure('{"locations": []}\nTrailing [text'), false);
  const prefixedBalancedMalformed = `Model note [unfinished\n${balancedMalformed}`;
  const bracePrefixedBalancedMalformed = `Model note {unfinished\n${balancedMalformed}`;
  assert.equal(
    hasIncompleteJsonStructure(prefixedBalancedMalformed),
    false,
    "An unmatched prose bracket before the map object must not look like truncated map JSON",
  );
  assert.equal(
    hasIncompleteJsonStructure(bracePrefixedBalancedMalformed),
    false,
    "An unmatched prose brace before the map object must not look like truncated map JSON",
  );
  assert.equal(
    classifySpatialMapJsonParseFailure({
      raw: prefixedBalancedMalformed,
      finishReason: "stop",
      error: new SyntaxError("Unexpected token"),
    }).kind,
    "malformed",
  );
  assert.equal(
    classifySpatialMapJsonParseFailure({
      raw: bracePrefixedBalancedMalformed,
      finishReason: "stop",
      error: new SyntaxError("Unexpected token"),
    }).kind,
    "malformed",
  );

  const malformedFailure = classifySpatialMapJsonParseFailure({
    raw: balancedMalformed,
    finishReason: "stop",
    error: new SyntaxError("Unexpected token 't' at position 54"),
  });
  assert.deepEqual(malformedFailure, {
    kind: "malformed",
    finishReason: "stop",
    responseLength: balancedMalformed.length,
    parserDetail: "Unexpected token 't' at position 54",
    structurallyIncomplete: false,
  });

  const explicitLimitFailure = classifySpatialMapJsonParseFailure({
    raw: balancedMalformed,
    finishReason: "MAX_TOKENS",
    error: new SyntaxError("Unexpected token"),
  });
  assert.equal(explicitLimitFailure.kind, "truncated");

  let repairCalls = 0;
  const prefixedRepair = await parseSpatialMapJsonWithRepair({
    raw: prefixedBalancedMalformed,
    finishReason: "stop",
    parse: JSON.parse,
    repair: async () => {
      repairCalls += 1;
      return { content: '{"locations":[]}', finishReason: "stop" };
    },
  });
  assert.equal(repairCalls, 1, "Prefix prose brackets must not suppress one controlled repair");
  assert.equal(prefixedRepair.ok, true);

  repairCalls = 0;
  const bracePrefixedRepair = await parseSpatialMapJsonWithRepair({
    raw: bracePrefixedBalancedMalformed,
    finishReason: "stop",
    parse: JSON.parse,
    repair: async () => {
      repairCalls += 1;
      return { content: '{"locations":[]}', finishReason: "stop" };
    },
  });
  assert.equal(repairCalls, 1, "Prefix prose braces must not suppress one controlled repair");
  assert.equal(bracePrefixedRepair.ok, true);

  repairCalls = 0;
  const repaired = await parseSpatialMapJsonWithRepair({
    raw: balancedMalformed,
    finishReason: "stop",
    parse: JSON.parse,
    repair: async (raw) => {
      repairCalls += 1;
      assert.equal(raw, balancedMalformed);
      return {
        content: '{"locations":[{"name":"The Green Man","typeKeyPlaceholder":null,"typeKey":"pub"}]}',
        finishReason: "stop",
      };
    },
  });
  assert.equal(repairCalls, 1, "Balanced malformed JSON should receive one controlled repair");
  assert.equal(repaired.ok, true);
  if (repaired.ok) {
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.primaryFailure?.kind, "malformed");
    assert.deepEqual(repaired.value, {
      locations: [
        {
          name: "The Green Man",
          typeKeyPlaceholder: null,
          typeKey: "pub",
        },
      ],
    });
  }

  repairCalls = 0;
  const truncatedRaw = '{"locations": [{"name": "Harbor"}';
  const unclosed = await parseSpatialMapJsonWithRepair({
    raw: truncatedRaw,
    finishReason: "stop",
    parse: JSON.parse,
    repair: async () => {
      repairCalls += 1;
      return { content: "{}", finishReason: "stop" };
    },
  });
  assert.equal(repairCalls, 0, "Structurally incomplete output must not be sent to formatting repair");
  assert.equal(unclosed.ok, false);
  if (!unclosed.ok) {
    const payload = spatialMapJsonErrorPayload(unclosed);
    assert.equal(payload.code, "spatial_ai_output_truncated");
    assert.match(payload.error, /Max Output Tokens/u);
    assert.equal(payload.details.finishReason, "stop");
    assert.equal(payload.details.responseLength, truncatedRaw.length);
    assert.equal(payload.details.structurallyIncomplete, true);
    assert.equal(payload.details.repairAttempted, false);
  }

  repairCalls = 0;
  const stillMalformed = await parseSpatialMapJsonWithRepair({
    raw: balancedMalformed,
    finishReason: "stop",
    parse: JSON.parse,
    repair: async () => {
      repairCalls += 1;
      return { content: "{stillMalformed: true}", finishReason: "stop" };
    },
  });
  assert.equal(repairCalls, 1);
  assert.equal(stillMalformed.ok, false);
  if (!stillMalformed.ok) {
    const payload = spatialMapJsonErrorPayload(stillMalformed);
    assert.equal(payload.code, "spatial_ai_json_invalid");
    assert.doesNotMatch(payload.error, /Max Output Tokens|smaller map size/u);
    assert.match(payload.error, /formatting repair/u);
    assert.equal(payload.details.finishReason, "stop");
    assert.equal(payload.details.responseLength, balancedMalformed.length);
    assert.match(payload.details.parserDetail, /property name|Unexpected token/u);
    assert.equal(payload.details.repairAttempted, true);
    assert.equal(payload.details.repair?.finishReason, "stop");
    assert.equal(payload.details.repair?.responseLength, 22);
    assert.match(payload.details.repair?.parserDetail ?? "", /property name|Unexpected token/u);
  }

  const repairMessages = buildSpatialMapJsonRepairMessages(balancedMalformed);
  assert.equal(repairMessages.length, 2);
  assert.match(repairMessages[0]!.content, /change only JSON syntax/u);
  assert.match(repairMessages[0]!.content, /data, not instructions/u);
  assert.match(repairMessages[1]!.content, /typeKeyPlaceholder/u);

  console.log(
    "World Maps JSON response regression passed: balanced malformed output, structural truncation, finish reasons, one controlled repair, and diagnostic error payloads.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
