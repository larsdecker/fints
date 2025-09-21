import { HKDSE } from "../hkdse";
import { HIDSE } from "../hidse";
import { testSegment } from "./utils";

const xml =
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?> <Document xmlns=\"urn:iso:std:iso:20022:tech:xsd:pain.008.003.02\">" +
    "<CstmrDrctDbtInitn></CstmrDrctDbtInitn></Document>";

const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.003.02";

const serializedHkdse =
    `HKDSE:3:1+DE44500105175407324931:INGDDEFFXXX+${descriptor}+@${xml.length}@${xml}'`;

testSegment(HKDSE, [
    {
        serialized: serializedHkdse,
        structured: {
            type: "HKDSE",
            segNo: 3,
            version: 1,
            account: {
                iban: "DE44500105175407324931",
                bic: "INGDDEFFXXX",
            },
            painDescriptor: descriptor,
            painMessage: xml,
        },
    },
], "out");

testSegment(HIDSE, [
    {
        serialized: "HIDSE:4:2:3+1234567890'",
        structured: {
            type: "HIDSE",
            segNo: 4,
            version: 2,
            reference: 3,
            taskId: "1234567890",
        },
    },
], "in");
