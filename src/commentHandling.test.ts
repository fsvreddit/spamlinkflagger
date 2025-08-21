import { commentContainsALink } from "./commentHandling.js";

test("commentContainsALink detects links", () => {
    const input = [
        { body: "Check this out: https://example.com", result: true },
        { body: "You can find it at www.badsite.com/something", result: true },
        { body: "No links here!", result: false },
    ];

    const actual = input.map(item => ({ body: item.body, result: commentContainsALink(item.body) }));

    expect(actual).toEqual(input);
});
