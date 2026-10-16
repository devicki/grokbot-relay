import { defineEval } from "@cursor/bdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "list",
      description: "Asked who it can talk to, it lists and does not send.",
      async test(t) {
        await t.send("Who can you talk to? List them. Do not message anyone.");
        t.succeeded();
        t.calledTool("grokbot__list");
        t.notCalledTool("grokbot__ask");
        t.notCalledTool("grokbot__interrupt");
      },
    },
  ],
});
