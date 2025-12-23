import { HKCCS } from "../hkccs";
import { HICCS } from "../hiccs";
import { testSegment } from "./utils";

const xml =
    '<?xml version="1.0" encoding="UTF-8"?> <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03">' +
    "<CstmrCdtTrfInitn></CstmrCdtTrfInitn></Document>";

const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.003.03";

const serializedHkccs = `HKCCS:3:1+DE02120300000000202051:COBADEFFXXX:1234567890::280:12030000+${descriptor}+@${xml.length}@${xml}'`;

testSegment(
    HKCCS,
    [
        {
            serialized: serializedHkccs,
            structured: {
                type: "HKCCS",
                segNo: 3,
                version: 1,
                account: {
                    iban: "DE02120300000000202051",
                    bic: "COBADEFFXXX",
                    accountNumber: "1234567890",
                    subAccount: "",
                    blz: "12030000",
                },
                painDescriptor: descriptor,
                painMessage: xml,
            },
        },
    ],
    "out",
);

testSegment(
    HICCS,
    [
        {
            serialized: "HICCS:4:1:3+TASK-12345'",
            structured: {
                type: "HICCS",
                segNo: 4,
                version: 1,
                reference: 3,
                taskId: "TASK-12345",
            },
        },
    ],
    "in",
);
