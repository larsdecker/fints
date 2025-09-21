import { Parse } from "../parse";
import { SegmentClass } from "./segment";

export class HITANProps {
    public segNo: number;
    public process: number;
    public transactionHash?: string;
    public transactionReference?: string;
    public challengeText?: string;
    public challengeMediaType?: string;
    public challengeMedia?: Buffer;
    public challengeValidUntil?: Date;
    public tanMedium?: string;
}

export class HITAN extends SegmentClass(HITANProps) {
    public type = "HITAN";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        if (![6, 7].includes(this.version)) {
            throw new Error(`Unimplemented TAN method version ${this.version} encountered.`);
        }
        if (this.version === 6) {
            const [[process], [transactionHash], [transactionReference], [challengeText], ...challengeHhdUc] = input;
            this.process = Parse.num(process as string);
            this.transactionHash = transactionHash;
            this.transactionReference = transactionReference;
            this.challengeText = challengeText;
            if (challengeHhdUc.length > 0) {
                [this.challengeMediaType, this.challengeMedia] = Parse.challengeHhdUc(challengeHhdUc);
            }
        } else {
            const [
                [process],
                transactionHash,
                transactionReference,
                challengeText,
                challengeHhdUc,
                challengeValidUntil,
                tanMedium,
            ] = input;
            this.process = Parse.num(process as string);
            if (transactionHash) { this.transactionHash = transactionHash[0]; }
            if (transactionReference) { this.transactionReference = transactionReference[0]; }
            if (challengeText) { this.challengeText = challengeText[0]; }
            if (challengeHhdUc && challengeHhdUc.length > 0) {
                [this.challengeMediaType, this.challengeMedia] =
                    Parse.challengeHhdUc(challengeHhdUc as unknown as string[][]);
            }
            if (challengeValidUntil && challengeValidUntil.length > 0) {
                const [dateStr, timeStr] = challengeValidUntil as string[];
                if (dateStr) {
                    const date = Parse.date(dateStr);
                    if (timeStr) {
                        const hours = Number(timeStr.substr(0, 2));
                        const minutes = Number(timeStr.substr(2, 2));
                        const seconds = Number(timeStr.substr(4, 2));
                        date.setHours(hours, minutes, seconds);
                    }
                    this.challengeValidUntil = date;
                }
            }
            if (tanMedium) { this.tanMedium = tanMedium[0]; }
        }
    }
}
