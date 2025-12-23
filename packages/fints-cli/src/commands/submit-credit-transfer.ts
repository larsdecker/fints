import { Command, command, metadata, option } from "clime";
import { PinTanClient, CreditTransferRequest, CreditTransferSubmission, TanRequiredError } from "fints-lib";
import { setLevel } from "../logger";
import { BaseConfig } from "../config";
import * as readline from "readline";

export class CreditTransferCommandOptions extends BaseConfig {
    @option({ required: true, name: "account-iban", description: "IBAN of the debtor account." })
    public accountIban: string;

    @option({ name: "debtor-name", description: "Name of the debtor (defaults to account owner)." })
    public debtorName?: string;

    @option({ required: true, name: "creditor-name", description: "Name of the creditor." })
    public creditorName: string;

    @option({ required: true, name: "creditor-iban", description: "IBAN of the creditor." })
    public creditorIban: string;

    @option({ name: "creditor-bic", description: "BIC of the creditor (optional)." })
    public creditorBic?: string;

    @option({ required: true, name: "amount", description: "Amount to transfer (e.g. 10.50)." })
    public amount: string;

    @option({ name: "currency", description: "Currency code (default EUR).", default: "EUR" })
    public currency?: string;

    @option({ name: "execution-date", description: "Requested execution date (YYYY-MM-DD)." })
    public executionDate?: string;

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

@command({ description: "Submit a SEPA credit transfer." })
export default class extends Command {
    @metadata
    public async execute(options: CreditTransferCommandOptions) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            verbose,
            json,
            serializer,
            accountIban,
            debtorName,
            creditorName,
            creditorIban,
            creditorBic,
            amount,
            currency = "EUR",
            executionDate,
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

        let debtorNameValue = debtorName?.trim();
        if (!debtorNameValue) {
            debtorNameValue = account.accountOwnerName || account.accountName;
        }
        if (!debtorNameValue) {
            console.error("A debtor name must be provided or available in the account metadata.");
            return;
        }

        let requestedExecutionDate: Date | undefined;
        if (executionDate) {
            const parsedDate = new Date(executionDate);
            if (isNaN(parsedDate.getTime())) {
                console.error("Execution date must be a valid date (YYYY-MM-DD).");
                return;
            }
            requestedExecutionDate = parsedDate;
        }

        const request: CreditTransferRequest = {
            debtorName: debtorNameValue,
            creditor: {
                name: creditorName,
                iban: creditorIban,
                bic: creditorBic ? creditorBic.toUpperCase() : undefined,
            },
            amount: parsedAmount,
            currency: currency.toUpperCase(),
            executionDate: requestedExecutionDate,
            endToEndId,
            remittanceInformation: remittance,
            purposeCode,
            batchBooking: !!batchBooking,
            messageId,
            paymentInformationId,
        };

        try {
            const submission = await client.creditTransfer(account, request);
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
                    console.error("A TAN is required to complete this credit transfer.");
                    return;
                }
                const submission: CreditTransferSubmission | undefined = challenge.creditTransferSubmission;
                if (!submission) {
                    console.error("Unable to resume the credit transfer because submission details are missing.");
                    return;
                }
                const result = await client.completeCreditTransfer(
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
