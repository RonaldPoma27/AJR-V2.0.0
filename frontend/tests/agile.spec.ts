// UI regression tests using explicitly isolated API fixtures. Backend persistence is tested separately.
import { test, expect } from "@playwright/test";
for (const mobile of [false, true])
  test(`agile workspace ${mobile ? "mobile English dark" : "desktop Spanish dark"}`, async ({
    page,
  }) => {
    const en = mobile;
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const now = "2026-10-29T12:00:00Z";
    const project = {
      id: 1,
      key: "TEST",
      name: "Test workspace",
      description: "Isolated test",
      status: "ACTIVE",
      sprint_length_weeks: 2,
      owner_id: 1,
      created_at: now,
      updated_at: now,
      my_role: "ADMIN",
      total_items: 1,
      completed_items: 0,
      active_sprint_name: null,
    };
    const items = [
      {
        id: 1,
        project_id: 1,
        key: "TEST-0001",
        title: "Test story",
        description: "",
        acceptance_criteria: "",
        item_type: "STORY",
        status: "TODO",
        priority: "MEDIUM",
        assigned_role: null,
        estimate_points: 3,
        order_index: 0,
        epic_id: null,
        epic_title: null,
        assignee_id: null,
        sprint_id: null,
        due_date: null,
        created_by_id: 1,
        is_archived: false,
        created_at: now,
        updated_at: now,
        completed_at: null,
      },
    ];
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (!path.startsWith("/api/")) {
        await route.continue();
        return;
      }
      let result: unknown = [];
      if (path.endsWith("/auth/me"))
        result = {
          id: 1,
          email: "admin@example.com",
          first_name: "Test",
          last_name: "Admin",
          role: "ADMIN",
        };
      else if (path.endsWith("/agile/projects")) result = [project];
      else if (path.endsWith("/agile/projects/1") && req.method() === "PATCH") {
        Object.assign(project, req.postDataJSON());
        result = project;
      } else if (path.endsWith("/items")) {
        if (req.method() === "POST") {
          const item = {
            ...items[0],
            ...req.postDataJSON(),
            id: items.length + 1,
            key: `TEST-000${items.length + 1}`,
          };
          items.push(item);
          result = item;
        } else result = items;
      } else if (/\/items\/\d+$/.test(path) && req.method() === "PATCH") {
        const item = items.find((i) => i.id === Number(path.split("/").at(-1)));
        Object.assign(item, req.postDataJSON());
        result = item;
      } else if (path.endsWith("/members"))
        result = [
          {
            id: 1,
            project_id: 1,
            user_id: 1,
            email: "admin@example.com",
            role: "SCRUM_MASTER",
            joined_at: now,
          },
        ];
      else if (path.endsWith("/imports/columns"))
        result = {
          headers: ["Summary", "Kind"],
          sample: [["Imported", "STORY"]],
        };
      await route.fulfill({ json: result });
    });
    await page.addInitScript(
      ({ en }) => {
        localStorage.setItem("ajrdata_token", "isolated-ui-test");
        localStorage.setItem("ajrdata_lang", en ? "en" : "es");
        localStorage.setItem("ajrdata_theme", en ? "dark" : "light");
      },
      { en },
    );
    await page.goto("/admin/proyectos-agiles");
    await expect(
      page.getByRole("heading", {
        name: en ? "Agile projects" : "Proyectos ágiles",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Test workspace/ }).click();
    await page
      .getByRole("button", { name: en ? "Board" : "Tablero", exact: true })
      .click();
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="BACKLOG"]') })
      .selectOption("ALL");
    const card = page.locator("article").filter({ hasText: "Test story" });
    await expect(card).toBeVisible();
    await card
      .getByLabel(en ? "Status" : "Estado", { exact: true })
      .selectOption("IN_PROGRESS");
    await expect(
      card.getByLabel(en ? "Status" : "Estado", { exact: true }),
    ).toHaveValue("IN_PROGRESS");
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: /^Backlog/ })
      .first()
      .click();
    await page
      .getByRole("button", {
        name: en ? "New card" : "Nueva tarjeta",
        exact: true,
      })
      .filter({ visible: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByLabel(en ? "Title" : "Título", { exact: true })
      .fill("Created in browser");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: en ? "Save card" : "Guardar tarjeta" })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Created in browser" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", {
        name: en ? "Project settings" : "Configuración del proyecto",
        exact: true,
      })
      .click();
    await page
      .getByLabel(en ? "Project name" : "Nombre del proyecto", { exact: true })
      .fill("Renamed workspace");
    await page
      .getByRole("button", {
        name: en ? "Save project" : "Guardar proyecto",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Renamed workspace" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `/tmp/ajr-${en ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
  });
