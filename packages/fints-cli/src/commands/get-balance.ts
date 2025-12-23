import { PinTanClient } from "fints-lib";
import { setLevel } from "../logger";
import { Command, command, metadata, option } from "clime";
import { BaseConfig } from "../config";

export class GetBalanceOptions extends BaseConfig {
    @option({ required: true, flag: "i", description: "IBAN of the account to fetch." })
    public iban: string;
}

@command({ description: "Fetch the current balance for a specified account." })
export default class extends Command {
    @metadata
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async execute({ verbose, json, serializer, iban, ...config }: GetBalanceOptions) {
        setLevel(verbose);
        const client = new PinTanClient(config);
        const accounts = await client.accounts();
        const account = accounts.find((current: any) => current.iban === iban);
        if (!account) {
            console.error("No account with specified iban found.");
            return;
        }
        const balance = await (client as any).balance(account);
        console.info(serializer(balance));
    }
}
