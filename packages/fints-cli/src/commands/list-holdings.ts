import { PinTanClient } from "fints-lib";
import { setLevel } from "../logger";
import { Command, command, metadata, option } from "clime";
import { BaseConfig } from "../config";

export class ListHoldingsOptions extends BaseConfig {
    @option({ required: true, flag: "i", description: "IBAN of the account to fetch." })
    public iban: string;
}

@command({ description: "List the holdings for a specified depot account." })
export default class extends Command {
    @metadata
    public async execute({ verbose, json, serializer, iban, ...config }: ListHoldingsOptions) {
        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current: any) => current.iban === iban);
        if (!account) {
            console.error("No account with specified iban found.");
            return;
        }
        try {
            const holdings = await (client as any).holdings(account);
            console.info(serializer(holdings));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(message);
        }
    }
}
