import { Parse } from "../parse";
import { Buffer } from "buffer";

describe("Parse", () => {
    test("bool", () => {
        expect(Parse.bool("J")).toBe(true);
        expect(Parse.bool("N")).toBe(false);
    });

    test("num", () => {
        expect(Parse.num("1,23")).toBeCloseTo(1.23);
        expect(Parse.num(undefined as any)).toBeUndefined();
    });

    test("dig", () => {
        expect(Parse.dig("00012")).toBe(12);
        expect(Parse.dig("0")).toBe(0);
    });

    test("date", () => {
        expect(Parse.date("20191224")).toEqual(new Date("2019-12-24T00:00:00.000Z"));
    });

    test("xml", () => {
        expect(Parse.xml("<root><child>1</child></root>")).toEqual({ root: { child: 1 } });
    });

    test("challengeHhdUc", () => {
        const mediaType = "image/png";
        const data = Buffer.from([1, 2, 3]);
        const buffer = Buffer.alloc(2 + mediaType.length + 2 + data.length);
        buffer.writeUIntBE(mediaType.length, 0, 2);
        buffer.write(mediaType, 2, mediaType.length, "utf8");
        buffer.writeUIntBE(data.length, 2 + mediaType.length, 2);
        data.copy(buffer, 2 + mediaType.length + 2);
        const latin1 = buffer.toString("latin1");
        const [mt, img] = Parse.challengeHhdUc([[latin1]]);
        expect(mt).toBe(mediaType);
        expect(img).toEqual(data);

        const [emptyType, emptyBuf] = Parse.challengeHhdUc(undefined as any);
        expect(emptyType).toBe("");
        expect(emptyBuf).toEqual(Buffer.alloc(0));
    });
});
