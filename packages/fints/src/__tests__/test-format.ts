import { Format } from "../format";

// FinTS 3.0 Formals TIME datatype (https://www.hbci-zka.de/downloads/FinTS_3_0/FinTS3.0_Formals_2010-12-20_final_version.pdf)
// specifies HHmmss with minutes rather than months.
describe("Format.time", () => {
    it("formats hours, minutes, and seconds as HHmmss", () => {
        const date = new Date(Date.UTC(2024, 11, 24, 8, 3, 45));
        expect(Format.time(date)).toBe("080345");
    });

    it("does not substitute the month for minutes", () => {
        const date = new Date(Date.UTC(2024, 5, 15, 12, 59, 1));
        expect(Format.time(date)).toBe("125901");
    });
});
