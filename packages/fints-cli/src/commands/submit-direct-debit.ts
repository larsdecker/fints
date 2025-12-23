import { Command, command, metadata, option } from "clime";
import { PinTanClient, DirectDebitRequest, DirectDebitSubmission, TanRequiredError } from "fints-lib";
import { setLevel } from "../logger";
import { BaseConfig } from "../config";
import * as readline from "readline";

export class DirectDebitCommandOptions extends BaseConfig {
    @option({ required: true, name: "account-iban", description: "IBAN of the creditor account." })
    public accountIban: string;

    @option({ required: true, name: "creditor-name", description: "Name of the creditor." })
    public creditorName: string;

    @option({ required: true, name: "creditor-id", description: "SEPA creditor identifier." })
    public creditorId: string;

    @option({ required: true, name: "debtor-name", description: "Name of the debtor." })
    public debtorName: string;

    @option({ required: true, name: "debtor-iban", description: "IBAN of the debtor." })
    public debtorIban: string;

    @option({ name: "debtor-bic", description: "BIC of the debtor (optional)." })
    public debtorBic?: string;

    @option({ required: true, name: "amount", description: "Amount to collect (e.g. 10.50)." })
    public amount: string;

    @option({ name: "currency", description: "Currency code (default EUR).", default: "EUR" })
    public currency?: string;

    @option({ required: true, name: "mandate-id", description: "SEPA mandate identifier." })
    public mandateId: string;

    @option({ required: true, name: "mandate-date", description: "Mandate signature date (YYYY-MM-DD)." })
    public mandateDate: string;

    @option({ required: true, name: "collection-date", description: "Requested collection date (YYYY-MM-DD)." })
    public collectionDate: string;

    @option({ name: "sequence-type", description: "Sequence type (OOFF, FRST, RCUR, FNAL).", default: "OOFF" })
    public sequenceType?: string;

    @option({ name: "local-instrument", description: "Local instrument (CORE or B2B).", default: "CORE" })
    public localInstrument?: string;

    @option({ name: "end-to-end-id", description: "End-to-end identifier." })
    public endToEndId?: string;

    @option({ name: "remittance", description: "Unstructured remittance information." })
    public remittance?: string;

    @option({ name: "purpose-code", description: "Purpose code for the transaction." })
    public purposeCode?: string;

    @option({ name: "message-id", description: "Override the generated message identifier." })
    public messageId?: string;

    @option({ name: "payment-information-id", description: "Override the generated payment information identifier." })
    public paymentInformationId?: string;

    @option({ toggle: true, name: "batch", description: "Request batch booking." })
    public batchBooking?: boolean;

    @option({ name: "tan", description: "Provide TAN upfront to avoid interactive prompt." })
    public tan?: string;
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

@command({ description: "Submit a SEPA direct debit." })
export default class extends Command {
    @metadata
    public async execute(options: DirectDebitCommandOptions) {
        const {
            verbose,
            json: _json,
            serializer,
            accountIban,
            creditorName,
            creditorId,
            debtorName,
            debtorIban,
            debtorBic,
            amount,
            currency = "EUR",
            mandateId,
            mandateDate,
            collectionDate,
            sequenceType = "OOFF",
            localInstrument = "CORE",
            endToEndId,
            remittance,
            purposeCode,
            messageId,
            paymentInformationId,
            batchBooking,
            tan,
            ...config
        } = options;

        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current: any) => current.iban === accountIban);
        if (!account) {
            console.error("No account with specified IBAN found.");
            return;
        }

        const parsedAmount = Number(amount.replace(",", "."));
        if (!isFinite(parsedAmount) || parsedAmount <= 0) {
            console.error("Amount must be a positive number.");
            return;
        }

        const mandateSignatureDate = new Date(mandateDate);
        if (isNaN(mandateSignatureDate.getTime())) {
            console.error("Mandate signature date must be a valid date (YYYY-MM-DD).");
            return;
        }

        const requestedCollectionDate = new Date(collectionDate);
        if (isNaN(requestedCollectionDate.getTime())) {
            console.error("Collection date must be a valid date (YYYY-MM-DD).");
            return;
        }

        const normalizedSequenceType = sequenceType.toUpperCase() as "OOFF" | "FRST" | "RCUR" | "FNAL";
        if (!["OOFF", "FRST", "RCUR", "FNAL"].includes(normalizedSequenceType)) {
            console.error("Sequence type must be one of OOFF, FRST, RCUR, FNAL.");
            return;
        }

        const normalizedInstrument = localInstrument.toUpperCase() as "CORE" | "B2B";
        if (!["CORE", "B2B"].includes(normalizedInstrument)) {
            console.error("Local instrument must be either CORE or B2B.");
            return;
        }

        const request: DirectDebitRequest = {
            creditorName,
            creditorId,
            debtor: {
                name: debtorName,
                iban: debtorIban,
                bic: debtorBic ? debtorBic.toUpperCase() : undefined,
            },
            amount: parsedAmount,
            currency: currency.toUpperCase(),
            endToEndId,
            remittanceInformation: remittance,
            purposeCode,
            mandateId,
            mandateSignatureDate,
            requestedCollectionDate,
            sequenceType: normalizedSequenceType,
            localInstrument: normalizedInstrument,
            batchBooking: !!batchBooking,
            messageId,
            paymentInformationId,
        };

        try {
            const submission = await client.directDebit(account, request);
            console.info(serializer(submission));
        } catch (error) {
            if (error instanceof TanRequiredError) {
                const challenge = error as TanRequiredError;
                console.info(challenge.message);
                if (challenge.challengeText) {
                    console.info(challenge.challengeText);
                }
                let tanValue = tan;
                if (!tanValue) {
                    tanValue = await prompt("Please enter TAN: ");
                }
                if (!tanValue) {
                    console.error("A TAN is required to complete this direct debit.");
                    return;
                }
                const submission: DirectDebitSubmission | undefined = challenge.directDebitSubmission;
                if (!submission) {
                    console.error("Unable to resume the direct debit because submission details are missing.");
                    return;
                }
                const result = await client.completeDirectDebit(
                    challenge.dialog,
                    challenge.transactionReference,
                    tanValue,
                    submission,
                );
                console.info(serializer(result));
            } else {
                throw error;
            }
        }
    }
}
