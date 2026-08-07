import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("chatbot model catalogue", () => {
  useTestDatabase();

  beforeEach(async () => {
    const { chatbotModels } = await import("@/lib/server/db/collections");
    await (await chatbotModels()).deleteMany({});
    const { resetSeededModelsFlag } =
      await import("@/lib/server/chatbot/models");
    resetSeededModelsFlag();
  });

  it("seeds defaults on first list and only once", async () => {
    const { listModels } = await import("@/lib/server/chatbot/models");
    const first = await listModels();
    expect(first.length).toBeGreaterThanOrEqual(3);
    const second = await listModels();
    expect(second.length).toBe(first.length);
  });

  it("exposes only enabled models to customers", async () => {
    const { listModels, listEnabledModels, setModelEnabled } =
      await import("@/lib/server/chatbot/models");
    const all = await listModels();
    await setModelEnabled(all[0].key, false);
    const enabled = await listEnabledModels();
    expect(enabled.every((m) => m.enabled)).toBe(true);
    expect(enabled.find((m) => m.key === all[0].key)).toBeUndefined();
  });

  it("keeps exactly one default", async () => {
    const { listModels, setDefaultModel } =
      await import("@/lib/server/chatbot/models");
    const all = await listModels();
    const target = all[all.length - 1].key;
    expect(await setDefaultModel(target)).toBe(true);

    const after = await listModels();
    const defaults = after.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].key).toBe(target);
  });

  it("upserts a custom model", async () => {
    const { upsertModel, getModel } =
      await import("@/lib/server/chatbot/models");
    await upsertModel({
      key: "custom/x",
      label: "Custom X",
      provider: "custom",
      inCostPerMTok: 1,
      outCostPerMTok: 3,
      maxContext: 32000,
      maxOutput: 2048,
      tempMin: 0,
      tempMax: 1,
      enabled: true,
      planIds: [],
      isDefault: false,
    });
    expect((await getModel("custom/x"))?.label).toBe("Custom X");
  });
});
