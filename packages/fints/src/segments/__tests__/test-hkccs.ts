import { HKCCS } from "../hkccs";
import { testSegment } from "./utils";
import { Format } from "../../format";
import { COUNTRY_CODE } from "../../constants";

const accountNumber = "1234567890";
const iban = "DE00123456780123456789";
const bic = "BANKDEFFXXX";
const blz = "10020030";
const sepaDescriptor = "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03";
const sepaMessage = "<Document><Test>1</Test></Document>";

const expectedAccount = [
    Format.stringEscaped(iban),
    Format.stringEscaped(bic),
    Format.stringEscaped(accountNumber),
    Format.empty(),
    String(COUNTRY_CODE),
    Format.stringEscaped(blz),
].join(":");

const expectedSerialized = `HKCCS:3:1+${expectedAccount}+${Format.stringEscaped(sepaDescriptor)}+${Format.stringWithLength(sepaMessage)}'`;

testSegment(HKCCS, [
    {
        serialized: expectedSerialized,
        structured: {
            type: "HKCCS",
            segNo: 3,
            version: 1,
            account: {
                iban,
                bic,
                accountNumber,
                blz,
            },
            sepaDescriptor,
            sepaMessage,
        },
    },
]);
