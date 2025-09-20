import { MT535Parser } from "../mt535";

describe("MT535Parser", () => {
    test("parses holdings from MT535 data", () => {
        const parser = new MT535Parser();
        const raw = `
:16R:GENL
:16S:GENL
:16R:SUBSAFE
:16R:FIN
:35B:ISIN LU0635178014|/DE/ETF127|COMS.-MSCI EM.M.T.U.ETF I
:90B::MRKT//ACTU/EUR38,82
:98A::PRIC//20170428
:93B::AGGR//UNIT/16,8211
:19A::HOLD//EUR970,17
:70E::HOLD//1STK|223,968293+EUR
:16S:FIN
:16S:SUBSAFE
-`;
        const result = parser.parse(raw.split(/\r?\n/));
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            isin: "LU0635178014",
            name: "COMS.-MSCI EM.M.T.U.ETF I",
            marketPrice: 38.82,
            currency: "EUR",
            pieces: 16.8211,
            totalValue: 970.17,
        });
        expect(result[0].valuationDate).toEqual(new Date(Date.UTC(2017, 3, 28)));
    });
});
