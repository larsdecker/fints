import { Command, command, metadata, option } from "clime";
import { PinTanClient } from "fints";
import { setLevel } from "../logger";
import { BaseConfig } from "../config";

export class ListStandingOrdersOptions extends BaseConfig {
    @option({ required: true, flag: "i", description: "IBAN of the account to use." })
    public iban: string;
}

@command({ description: "List standing orders for the specified account." })
export default class extends Command {
    @metadata
    public async execute({ verbose, json, serializer, iban, ...config }: ListStandingOrdersOptions) {
        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current) => current.iban === iban);
        if (!account) {
            console.error("No account with specified IBAN found.");
            return;
        }
        const orders = await client.standingOrders(account);
        console.info(serializer(orders));
    }
}
