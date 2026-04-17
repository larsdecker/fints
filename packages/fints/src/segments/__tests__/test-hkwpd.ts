import { HKWPD } from "../hkwpd";
import { testSegment } from "./utils";

const accountNumber = "01234";
const blz = "12345678";
const iban = "DE8450010517800538200X";
const bic = "INGDDEFFXXX";

testSegment(
    HKWPD,
    [
        {
            // Version 5 uses the legacy domestic format (KTV): accountNumber::countryCode:blz
            serialized: "HKWPD:3:5+01234::280:12345678++++'",
            structured: {
                type: "HKWPD",
                segNo: 3,
                version: 5,
                account: { accountNumber, blz },
            },
        },
        {
            // Version 6 uses the SEPA/international format (KTIN): iban:bic:accountNumber::countryCode:blz
            serialized: "HKWPD:3:6+DE8450010517800538200X:INGDDEFFXXX:01234::280:12345678++++'",
            structured: {
                type: "HKWPD",
                segNo: 3,
                version: 6,
                account: { accountNumber, blz, iban, bic },
            },
        },
    ],
    "out",
);
