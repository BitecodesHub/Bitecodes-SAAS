import { describe, expect, it } from "vitest";
import { featuredProjects, projects } from "@/data/projects";
import { industries } from "@/data/industries";
import { services } from "@/data/services";

const industrySlugs = new Set(industries.map((industry) => industry.slug));
const serviceSlugs = new Set(services.map((service) => service.slug));
const relationships = new Set(["client", "internal", "related-party"]);
const relationshipRank: Record<string, number> = {
  client: 0,
  "related-party": 1,
  internal: 2,
};

describe("projects", () => {
  it("references only real industry and service slugs", () => {
    for (const project of projects) {
      if (project.industry) {
        expect(industrySlugs.has(project.industry), project.slug).toBe(true);
      }
      for (const service of project.services ?? []) {
        expect(serviceSlugs.has(service), project.slug).toBe(true);
      }
    }
  });

  it("populates engagement and qualitative outcomes without result metrics", () => {
    for (const project of projects) {
      expect(project.engagement?.trim(), project.slug).toBeTruthy();
      expect(project.services?.length, project.slug).toBeGreaterThan(0);
      expect(project.outcomes?.length, project.slug).toBeGreaterThan(0);
      expect(project, project.slug).not.toHaveProperty("results");
    }
  });

  it("labels every project with an honest relationship", () => {
    for (const project of projects) {
      expect(project.relationship, project.slug).toBeDefined();
      expect(relationships.has(project.relationship ?? ""), project.slug).toBe(
        true,
      );
      expect(project.client.trim(), project.slug).not.toBe("");
      if (project.relationship === "internal") {
        expect(project.client, project.slug).toBe("Bitecodes");
      }
      if (project.client === "Bitecodes") {
        expect(project.relationship, project.slug).toBe("internal");
      }
    }
  });

  it("features client work ahead of related-party and internal work", () => {
    const ranks = featuredProjects.map(
      (project) => relationshipRank[project.relationship ?? "client"],
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(featuredProjects.some((project) => project.featured)).toBe(true);
  });
});
