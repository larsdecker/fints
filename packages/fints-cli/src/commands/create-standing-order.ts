import { Command, command, metadata, option } from "clime";
import { PinTanClient, StandingOrderCreation, TanRequiredError } from "fints";
import { BaseConfig } from "../config";
import { setLevel } from "../logger";
import { promptTan } from "../tan";

export class CreateStandingOrderOptions extends BaseConfig {
    @option({ required: true, flag: "i", description: "IBAN of the debit account." })
    public iban: string;

    @option({ required: true, flag: "a", description: "Amount for each execution." })
    public amount: number;

    @option({ flag: "c", description: "Currency code (defaults to EUR).", default: "EUR" })
    public currency: string;

    @option({ required: true, flag: "P", description: "Payment purpose." })
    public purpose: string;

    @option({ required: true, description: "Creditor name." })
    public creditorName: string;

    @option({ required: true, description: "Creditor IBAN." })
    public creditorIban: string;

    @option({ required: true, description: "Creditor BIC." })
    public creditorBic: string;

    @option({ description: "Override debitor name." })
    public debitorName: string;

    @option({ description: "Override debitor IBAN." })
    public debitorIban: string;

    @option({ description: "Override debitor BIC." })
    public debitorBic: string;

    @option({ required: true, flag: "s", description: "First execution date (YYYY-MM-DD)." })
    public start: string;

    @option({ required: true, flag: "t", description: "Time unit for repetition (e.g. D, W, M)." })
    public timeUnit: string;

    @option({ required: true, flag: "n", description: "Interval for repetition." })
    public interval: number;

    @option({ flag: "D", description: "Day of execution for monthly schedules." })
    public executionDay: number;

    @option({ flag: "e", description: "Optional end date (YYYY-MM-DD)." })
    public end: string;
}

function parseDate(value: string, name: string): Date {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
        throw new Error(`Invalid ${name} provided.`);
    }
    return parsed;
}

@command({ description: "Create a new standing order." })
export default class extends Command {
    @metadata
    public async execute(options: CreateStandingOrderOptions) {
        const { verbose, serializer, iban, amount, currency, purpose, creditorName, creditorIban, creditorBic, debitorName, debitorIban, debitorBic, start, timeUnit, interval, executionDay, end, ...config } = options;
        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current) => current.iban === iban);
        if (!account) {
            console.error("No account with specified IBAN found.");
            return;
        }
        const creation: StandingOrderCreation = {
            payment: {
                amount,
                currency,
                purpose,
                creditor: {
                    name: creditorName,
                    iban: creditorIban,
                    bic: creditorBic,
                },
            },
            schedule: {
                startDate: parseDate(start, "start date"),
                timeUnit,
                interval,
                executionDay,
                endDate: end ? parseDate(end, "end date") : undefined,
            },
        };
        if (debitorName || debitorIban || debitorBic) {
            creation.payment.debitor = {
                name: debitorName || account.accountOwnerName || account.accountName || "",
                iban: debitorIban || account.iban,
                bic: debitorBic || account.bic,
            };
        }
        try {
            const result = await client.createStandingOrder(account, creation);
            console.info(serializer(result));
        } catch (error) {
            if (error instanceof TanRequiredError) {
                if (error.challengeMedia?.length) {
                    console.info("Challenge media provided (binary data omitted).");
                }
                const tan = await promptTan(error.challengeText);
                const result = await client.completeCreateStandingOrder(error.dialog, error.transactionReference, tan);
                console.info(serializer(result));
            } else {
                throw error;
            }
        }
    }
}
