import { Format } from "../format";
import { SegmentClass } from "./segment";
import { SEPAAccount } from "../types";
import { COUNTRY_CODE } from "../constants";

export class HKWPDProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public currency?: string;
    public quality?: string;
    public maxEntries?: number;
    public touchdown?: string;
}

/**
 * HKWPD (Depotaufstellung anfordern)
 * Section D.6.1
 */
export class HKWPD extends SegmentClass(HKWPDProps) {
    public type = "HKWPD";

    protected serialize() {
        const { version, account, currency, quality, maxEntries, touchdown } = this;
        const { iban, bic, accountNumber, subAccount, blz } = account;
        if (![5, 6].includes(version)) {
            throw new Error(`Unsupported HKWPD version ${version}.`);
        }
        // Version 6 uses the SEPA / international account format (KTIN) — IBAN + BIC.
        // Version 5 uses the legacy domestic format (KTV) — account number + BLZ.
        const serializedAccount =
            version === 6
                ? [iban, bic, accountNumber, subAccount, String(COUNTRY_CODE), blz]
                : [accountNumber, subAccount, String(COUNTRY_CODE), blz];
        return [
            serializedAccount,
            currency || Format.empty(),
            quality || Format.empty(),
            typeof maxEntries === "number" ? Format.num(maxEntries) : Format.empty(),
            Format.stringEscaped(touchdown),
        ];
    }

    protected deserialize() {
        throw new Error("Not implemented.");
    }
}
