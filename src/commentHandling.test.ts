import { commentContainsALink } from "./commentHandling.js";

test("commentContainsALink detects links", () => {
    expect(commentContainsALink("Check this out: https://example.com")).toBe(true);
    expect(commentContainsALink("You can find it at www.badsite.com/something")).toBe(true);
    expect(commentContainsALink("No links here!")).toBe(false);
});
