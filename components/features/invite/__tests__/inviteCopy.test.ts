import { env, websiteHostFor } from "@/config/env";
import {
  INVITE_COPY,
  inviteLink,
  shareMessage,
  spokenCode,
} from "../inviteCopy";

describe("invite copy", () => {
  it("builds the agreed share text on the configured host", () => {
    const link = `https://${env.referralLinkHost}/invite/AX7KPQ2M`;
    expect(inviteLink("AX7KPQ2M")).toBe(link);
    expect(shareMessage("AX7KPQ2M")).toBe(
      `Join me on HunterX! Use my code AX7KPQ2M: ${link}`,
    );
  });

  it("links to the website that matches the API", () => {
    expect(websiteHostFor("https://api.hunterx.co.in/api")).toBe(
      "www.hunterx.co.in",
    );
    expect(websiteHostFor("https://api-uat.hunterx.co.in/api")).toBe(
      "uat.hunterx.co.in",
    );
    expect(websiteHostFor("http://localhost:5001/api")).toBe(
      "uat.hunterx.co.in",
    );
  });

  it("spells the code out for screen readers", () => {
    expect(spokenCode("AX7K")).toBe("A, X, 7, K");
  });

  it("never promises anything for inviting", () => {
    const strings = Object.values(INVITE_COPY).map((value) =>
      typeof value === "function" ? value("3" as never) : value,
    );
    for (const text of strings) {
      expect(text).not.toMatch(/\b(earn|rewards?|bonus|free)\b/i);
    }
  });
});
