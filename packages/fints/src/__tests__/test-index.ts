import * as API from "../index";

describe("library entry point", () => {
    test("re-exports selected modules", () => {
        expect(API).toHaveProperty("Client");
        expect(API).toHaveProperty("Dialog");
        expect(API).toHaveProperty("PinTanClient");
        expect(API).toHaveProperty("buildPain008");
        expect(API).toHaveProperty("buildPain001");
        expect(API).toHaveProperty("TanRequiredError");
    });
});
