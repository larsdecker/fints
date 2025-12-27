import { Format } from "../format";

describe("Format.date", () => {
    it("formats FinTS DATE values as an eight-digit yyyyMMdd string", () => {
        const date = new Date(Date.UTC(2023, 10, 9, 12, 0, 0));

        const formatted = Format.date(date);

        expect(formatted).toBe("20231109");
        expect(formatted).toHaveLength(8);
        expect(formatted).toMatch(/^[0-9]{8}$/);
    });

    it("pads years below 1000 to a four-digit year", () => {
        const date = new Date("0012-06-07T12:00:00Z");

        const formatted = Format.date(date);

        expect(formatted).toBe("00120607");
    });
});
