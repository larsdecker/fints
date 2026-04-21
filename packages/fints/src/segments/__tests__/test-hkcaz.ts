import { HKCAZ } from "../hkcaz";
import { testSegment } from "./utils";

const account = {
    accountNumber: "01234",
    blz: "12345678",
    iban: "DE27100777770209299700",
    bic: "DEUTDEFF500",
};

testSegment(
    HKCAZ,
    [
        {
            serialized: "HKCAZ:3:1+DE27100777770209299700:DEUTDEFF500:01234::280:12345678+camt.052+N+20181010+20181101++'",
            structured: {
                type: "HKCAZ",
                segNo: 3,
                version: 1,
                account,
                camtFormat: "camt.052",
                startDate: new Date("2018-10-10T00:00:00Z"),
                endDate: new Date("2018-11-01T00:00:00Z"),
                touchdown: "",
            },
        },
    ],
    "out",
);
