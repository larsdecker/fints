import { Format } from "../format";
import { COUNTRY_CODE } from "../constants";
import { Parse } from "../parse";
import { SEPAAccount } from "../types";
import { SegmentClass } from "./segment";

export class HKCCSProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public sepaDescriptor: string;
    public sepaMessage: string;
}

/**
 * HKCCS (SEPA credit transfer)
 * Section C.10.2.1 a)
 */
export class HKCCS extends SegmentClass(HKCCSProps) {
    public type = "HKCCS";

    protected defaults() {
        this.version = 1;
    }

    protected serialize() {
        const { account, sepaDescriptor, sepaMessage } = this;
        if (!account) {
            throw new Error("HKCCS requires an account to be specified.");
        }
        if (!sepaDescriptor) {
            throw new Error("HKCCS requires a SEPA descriptor.");
        }
        if (!sepaMessage) {
            throw new Error("HKCCS requires a SEPA message payload.");
        }
        const {
            iban,
            bic,
            accountNumber,
            subAccount,
            blz,
        } = account;
        return [
            [
                Format.stringEscaped(iban),
                Format.stringEscaped(bic),
                Format.stringEscaped(accountNumber),
                Format.stringEscaped(subAccount),
                String(COUNTRY_CODE),
                Format.stringEscaped(blz),
            ],
            Format.stringEscaped(sepaDescriptor),
            Format.stringWithLength(sepaMessage),
        ];
    }

    protected deserialize(input: string[][]) {
        const [account, descriptor, payload] = input;
        if (!account) {
            throw new Error("Invalid HKCCS segment. Missing account information.");
        }
        const [
            iban,
            bic,
            accountNumber,
            subAccount,
            ,
            blz,
        ] = account;
        this.account = {
            iban: iban || "",
            bic: bic || "",
            accountNumber: accountNumber || "",
            subAccount: subAccount || undefined,
            blz: blz || "",
        };
        if (descriptor) {
            this.sepaDescriptor = descriptor[0];
        }
        if (payload) {
            this.sepaMessage = this.parseBinary(payload[0]);
        }
    }

    private parseBinary(value: string) {
        if (!value) { return ""; }
        if (!value.startsWith("@")) { return value; }
        const secondAt = value.indexOf("@", 1);
        if (secondAt === -1) { return value; }
        const lengthPart = value.substring(1, secondAt);
        const length = Parse.num(lengthPart);
        return value.substr(secondAt + 1, length);
    }
}
