import {
    PinTanClient,
    CreditTransferParameters,
    CreditTransferOptions as TransferOptions,
    CreditTransferReceipt,
    Pain001Schema,
    TanRequiredError,
} from "fints";
import { setLevel } from "../logger";
import { Command, command, metadata, option } from "clime";
import { BaseConfig } from "../config";

function parseAmount(amount: string): number {
    const parsed = Number(amount);
    if (isNaN(parsed)) {
        throw new Error("Amount must be a valid number.");
    }
    return parsed;
}

function parseSchema(schema?: string): Pain001Schema | undefined {
    if (!schema) { return undefined; }
    const supported: Pain001Schema[] = ["pain.001.001.03", "pain.001.003.03", "pain.001.001.09"];
    if (!supported.includes(schema as Pain001Schema)) {
        throw new Error(`Unsupported pain.001 schema "${schema}".`);
    }
    return schema as Pain001Schema;
}

export class SubmitCreditTransferOptions extends BaseConfig {
    @option({ required: true, description: "IBAN of the account to debit." })
    public iban: string;

    @option({ required: true, description: "Name of the debtor." })
    public debtorName: string;

    @option({ description: "Name of the initiating party." })
    public initiatingPartyName?: string;

    @option({ required: true, description: "Name of the creditor." })
    public creditorName: string;

    @option({ required: true, description: "IBAN of the creditor." })
    public creditorIban: string;

    @option({ required: true, description: "BIC of the creditor." })
    public creditorBic: string;

    @option({ required: true, description: "Amount to transfer." })
    public amount: string;

    @option({ description: "Currency to use.", default: "EUR" })
    public currency: string;

    @option({ description: "Remittance information." })
    public remittance?: string;

    @option({ description: "End-to-end identifier." })
    public endToEndId?: string;

    @option({ description: "pain.001 schema to use." })
    public schema?: string;

    @option({ description: "Message identifier to use for the pain.001 document." })
    public messageId?: string;

    @option({ description: "Payment information identifier to use for the pain.001 document." })
    public paymentInformationId?: string;

    @option({ description: "Requested execution date (YYYY-MM-DD)." })
    public executionDate?: string;

    @option({ description: "Charge bearer to use for the transfer." })
    public chargeBearer?: string;

    @option({ description: "Provide a TAN to finalize a pending transfer." })
    public tan?: string;

    @option({ description: "Transaction reference received during the TAN challenge." })
    public transactionReference?: string;

    @option({ description: "Dialog state returned when the TAN was requested (base64 encoded JSON)." })
    public dialog?: string;
}

@command({ description: "Submit a SEPA credit transfer." })
export default class extends Command {
    @metadata
    public async execute({ verbose, serializer, tan, transactionReference, dialog, ...config }: SubmitCreditTransferOptions) {
        try {
            const amount = parseAmount(config.amount);
            const schema = parseSchema(config.schema);
            const executionDate = config.executionDate ? new Date(config.executionDate) : undefined;
            if (executionDate && isNaN(executionDate.getTime())) {
                throw new Error("Invalid execution date provided.");
            }
            setLevel(verbose);
            const client = new PinTanClient(config);
            const accounts = await client.accounts();
            const account = accounts.find((candidate) => candidate.iban === config.iban);
            if (!account) {
                throw new Error("No account with the specified IBAN was found.");
            }
            if (!account.bic) {
                throw new Error("The selected account does not provide a BIC which is required for transfers.");
            }
            const transfer: CreditTransferParameters = {
                debtor: {
                    name: config.debtorName,
                    iban: account.iban,
                    bic: account.bic,
                },
                debtorName: config.debtorName,
                initiatingPartyName: config.initiatingPartyName ?? config.debtorName,
                messageId: config.messageId,
                paymentInformationId: config.paymentInformationId,
                executionDate,
                chargeBearer: config.chargeBearer,
                schema,
                transactions: [
                    {
                        creditor: {
                            name: config.creditorName,
                            iban: config.creditorIban,
                            bic: config.creditorBic,
                        },
                        amount,
                        currency: config.currency,
                        remittanceInformation: config.remittance,
                        endToEndId: config.endToEndId,
                    },
                ],
            };
            const options: TransferOptions = {};
            if (tan) { options.tan = tan; }
            if (transactionReference) { options.transactionReference = transactionReference; }
            if (dialog) {
                const parsedDialog = JSON.parse(Buffer.from(dialog, "base64").toString("utf8"));
                options.dialog = parsedDialog;
            }
            const receipt: CreditTransferReceipt = await client.creditTransfer(account, transfer, options);
            console.info(serializer(receipt));
        } catch (error) {
            if (error instanceof TanRequiredError) {
                const payload = {
                    message: error.message,
                    challengeText: error.challengeText,
                    challengeMedia: error.challengeMedia.length > 0 ? error.challengeMedia.toString("base64") : undefined,
                    transactionReference: error.transactionReference,
                    dialog: Buffer.from(JSON.stringify(error.dialog)).toString("base64"),
                    messageId: error.context?.messageId,
                    paymentInformationId: error.context?.paymentInformationId,
                    schema: error.context?.schema,
                };
                console.info(serializer(payload));
                return;
            }
            if (error instanceof Error) {
                console.error(error.message);
            } else {
                console.error(error);
            }
        }
    }
}
