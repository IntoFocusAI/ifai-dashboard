import { expect, test, type Locator } from "./fixtures";

async function setAside(item: Locator, reason: string, note: string, name: string) {
  await item.locator("[data-cc-set-aside]").click();
  const form = item.locator("[data-set-aside-form]");
  await form.locator("[data-set-aside-reason]").selectOption(reason);
  if (note) await form.locator("[data-set-aside-note]").fill(note);
  await form.locator("[data-set-aside-name]").fill(name);
  await form.locator("[data-set-aside-save]").click();
}

/* The "what do I need to worry about" queue: opens from Priorities, assignable,
   and every row a route into the detail behind it. */
test.describe("command center", () => {
  test("opens from the priorities control", async ({ canvas, page }) => {
    await canvas.openCommandCenter();
    await expect(canvas.commandCenter).toBeVisible();
    await expect(canvas.priorities).toHaveCount(5);
    await expect(canvas.commandCenter).not.toContainText("3,430");
    await expect(canvas.commandCenter).not.toContainText("993");
    await expect(canvas.commandCenter).not.toContainText("7.4%");
    await expect(canvas.commandCenter).not.toContainText("16.7%");
    await expect(canvas.commandCenter).not.toContainText("Fourteen");
    await expect(canvas.commandCenter).not.toContainText("14 catalog");
    await expect(canvas.commandCenter).not.toContainText("Discounted bundles");
    await expect(canvas.commandCenter).toContainText("Fender MAP prices have not been stored.");
    await expect(canvas.page.locator(".drilldown-title")).toContainText(
      "What do I need to worry about?",
    );
  });

  test("every priority explains why it is top of the list", async ({ canvas }) => {
    await canvas.openCommandCenter();
    const whys = canvas.page.locator(".cc-why p");
    await expect(whys).toHaveCount(5);
    for (const text of await whys.allInnerTexts()) {
      expect(text.trim().length).toBeGreaterThan(40);
    }
  });

  test("counts reflect the queue", async ({ canvas, page }) => {
    await canvas.openCommandCenter();
    const quadrants = page.locator(".cc-quadrant");
    await expect(quadrants.nth(1)).toContainText("5");
    await expect(quadrants.nth(0)).toContainText("1"); // critical

    await setAside(canvas.priority("Buy Box withheld"), "discontinued", "", "Test Person");
    await expect(canvas.priorities).toHaveCount(4);
    await expect(quadrants.nth(1)).toContainText("4");
    await expect(page.locator(".cc-cleared summary")).toContainText("0 done · 1 set aside");
  });

  test("set aside needs a reason and a name, and is stored server-side", async ({ canvas, page, setAsides }) => {
    await canvas.openCommandCenter();
    const item = canvas.priority("Buy Box withheld");
    await item.locator("[data-cc-set-aside]").click();
    const form = item.locator("[data-set-aside-form]");
    await form.locator("[data-set-aside-save]").click();
    await expect(form.locator(".set-aside-error")).toHaveText("Pick a reason.");

    await form.locator("[data-set-aside-reason]").selectOption("other");
    await form.locator("[data-set-aside-name]").fill("Test Person");
    await form.locator("[data-set-aside-save]").click();
    await expect(form.locator(".set-aside-error")).toContainText("needs a note");
    expect(setAsides.calls).toHaveLength(0);

    await form.locator("[data-set-aside-note]").fill("Handled on the retailer side");
    await form.locator("[data-set-aside-save]").click();
    await expect(canvas.priorities).toHaveCount(4);
    expect(setAsides.calls[0]).toMatchObject({
      fn: "set_aside_issue",
      body: {
        p_client_key: "fmic",
        p_check_key: "command_center_queue",
        p_entity_key: "buybox-suppression",
        p_reason_code: "other",
        p_name: "Test Person",
        p_note: "Handled on the retailer side",
      },
    });

    await page.locator(".cc-cleared summary").click();
    await expect(page.locator(".cc-cleared")).toContainText("Other · Handled on the retailer side — Test Person");
  });

  test("done needs only a name and is counted apart from set aside", async ({ canvas, page, setAsides }) => {
    await canvas.openCommandCenter();
    const item = canvas.priority("Buy Box withheld");
    await item.locator("[data-cc-done]").click();
    const form = item.locator("[data-done-form]");
    await form.locator("[data-set-aside-name]").fill("Test Person");
    await form.locator("[data-set-aside-note]").fill("Walmart price fixed");
    await form.locator("[data-done-save]").click();
    await expect(canvas.priorities).toHaveCount(4);
    expect(setAsides.calls[0]).toMatchObject({
      fn: "mark_issue_done",
      body: { p_check_key: "command_center_queue", p_entity_key: "buybox-suppression", p_name: "Test Person" },
    });
    await expect(page.locator(".cc-cleared summary")).toContainText("1 done · 0 set aside");
    await page.locator(".cc-cleared summary").click();
    await expect(page.locator(".cc-cleared")).toContainText("Done · Walmart price fixed — Test Person");
  });

  test("reopen updates the same set-aside row", async ({ canvas, page, setAsides }) => {
    await canvas.openCommandCenter();
    await setAside(canvas.priorities.first(), "discontinued", "", "Test Person");
    await expect(canvas.priorities).toHaveCount(4);

    await page.locator(".cc-cleared summary").click();
    await page.locator("[data-cc-reopen]").first().click();
    // The name is remembered from the set-aside.
    await expect(page.locator("[data-reopen-form] [data-set-aside-name]")).toHaveValue("Test Person");
    await page.locator("[data-reopen-save]").click();
    await expect(canvas.priorities).toHaveCount(5);
    await expect(page.locator(".cc-cleared summary")).toContainText("0 done · 0 set aside · 1 reopened");
    expect(setAsides.rows).toHaveLength(1);
    expect(setAsides.rows[0].status).toBe("reopened");

    await setAside(canvas.priorities.first(), "discontinued", "", "Test Person");
    expect(setAsides.rows).toHaveLength(1);
    expect(setAsides.rows[0].status).toBe("active");
  });

  test("work can be assigned and survives a reload", async ({ canvas }) => {
    await canvas.openCommandCenter();
    const item = canvas.priority("Buy Box withheld");
    await expect(item.locator(".cc-owner-btn.active")).toHaveText("IntoFocus AI");

    await item.locator(".cc-owner-btn", { hasText: "Client team" }).click();
    await expect(item.locator(".cc-owner-btn.active")).toHaveText("Client team");

    await canvas.reload();
    await canvas.openCommandCenter();
    await expect(
      canvas.priority("Buy Box withheld").locator(".cc-owner-btn.active"),
    ).toHaveText("Client team");
  });

  test("clicking the active owner clears the assignment", async ({ canvas }) => {
    await canvas.openCommandCenter();
    const item = canvas.priorities.first();
    await item.locator(".cc-owner-btn", { hasText: "IntoFocus AI" }).click();
    await expect(item.locator(".cc-owner-btn.active")).toHaveCount(0);
  });

  /* Each priority must land on the tab that actually holds its evidence. */
  const routes = [
    ["Buy Box withheld", "Retail Overview"],
    ["machine-readable spec", "Brand-Site Specs"],
    ["Fender MAP prices have not been stored", "MAP"],
    ["out-mention Fender/Squier", "Competitor Wins"],
    ["A+ comparison tables", "A+"],
  ] as const;

  for (const [title, tab] of routes) {
    test(`"${title}" opens the ${tab} tab`, async ({ canvas }) => {
      await canvas.openPriority(title);
      await expect(canvas.activeTab).toContainText(tab);
    });
  }

  test("the back control returns to the queue", async ({ canvas }) => {
    await canvas.openPriority("Buy Box withheld");
    await canvas.backToPriorities();
    await expect(canvas.priorities).toHaveCount(5);
  });

  test("the header Priorities button reopens the queue from a spoke", async ({
    canvas,
    page,
  }) => {
    await canvas.openPriority("out-mention Fender/Squier");
    await page.locator(".hdr-btn", { hasText: "Priorities" }).click();
    await expect(canvas.commandCenter).toBeVisible();
  });
});
