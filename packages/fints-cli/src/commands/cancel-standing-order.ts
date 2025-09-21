import { Command, command, metadata, option } from "clime";
import { PinTanClient, TanRequiredError } from "fints";
import { BaseConfig } from "../config";
import { setLevel } from "../logger";
import { promptTan } from "../tan";

export class CancelStandingOrderOptions extends BaseConfig {
    @option({ required: true, flag: "i", description: "IBAN of the debit account." })
    public iban: string;

    @option({ required: true, flag: "O", description: "Identifier of the standing order." })
    public orderId: string;
}

@command({ description: "Cancel an existing standing order." })
export default class extends Command {
    @metadata
    public async execute({ verbose, serializer, iban, orderId, ...config }: CancelStandingOrderOptions) {
        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current) => current.iban === iban);
        if (!account) {
            console.error("No account with specified IBAN found.");
            return;
        }
        const orders = await client.standingOrders(account);
        const order = orders.find((current) => current.orderId === orderId);
        if (!order) {
            console.error("No standing order with specified identifier found.");
            return;
        }
        try {
            const result = await client.cancelStandingOrder(account, order);
            console.info(serializer(result));
        } catch (error) {
            if (error instanceof TanRequiredError) {
                if (error.challengeMedia?.length) {
                    console.info("Challenge media provided (binary data omitted).");
                }
                const tan = await promptTan(error.challengeText);
                const result = await client.completeCancelStandingOrder(error.dialog, error.transactionReference, tan);
                console.info(serializer(result));
            } else {
                throw error;
            }
        }
    }
}
