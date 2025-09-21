import "isomorphic-fetch";
import { Dialog, DialogConfig } from "./dialog";
import { Parse } from "./parse";
import { Segment, HKSPA, HISPA, HKKAZ, HIKAZ, HKSAL, HISAL, HKCDB, HICDB, HKTAN, HKWPD, HIWPD } from "./segments";
import { Request } from "./request";
import { Response } from "./response";
import { SEPAAccount, Statement, Balance, StandingOrder, Holding } from "./types";
import { read } from "mt940-js";
import { parse86Structured } from "./mt940-86-structured";
import { MT535Parser } from "./mt535";

/**
 * An abstract class for communicating with a fints server.
 * For a common implementation look at `PinTanClient`.
 */
export abstract class Client {
    /**
     * Create a new dialog.
     */
    protected abstract createDialog(dialogConfig?: DialogConfig): Dialog;
    /**
     * Create a request.
     */
    protected abstract createRequest(dialog: Dialog, segments: Segment<any>[], tan?: string): Request;

    /**
     * Fetch a list of all SEPA accounts accessible by the user.
     *
     * @param existingDialog Optionally reuse an already authenticated dialog instance.
     * @return An array of all SEPA accounts.
     */
    public async accounts(existingDialog?: Dialog): Promise<SEPAAccount[]> {
        const dialog = existingDialog ?? this.createDialog();
        const shouldInitializeDialog = !existingDialog;
        if (shouldInitializeDialog) {
            await dialog.sync();
            await dialog.init();
        }
        const response = await dialog.send(this.createRequest(dialog, [new HKSPA({ segNo: 3 })]));
        if (shouldInitializeDialog) {
            await dialog.end();
        }
        const hispa = response.findSegment(HISPA);

        hispa.accounts.map((account) => {
            const hiupdAccount = dialog.hiupd.filter((element) => {
                return element.account.iban === account.iban;
            });
            if (hiupdAccount.length > 0) {
                return {
                    ...account,
                    accountOwnerName: hiupdAccount[0].account.accountOwnerName1,
                    accountName: hiupdAccount[0].account.accountName,
                    limitValue: Parse.num(hiupdAccount[0].account.limitValue),
                };
            }
        });

        return hispa.accounts;
    }

    /**
     * Fetch the balance for a SEPA account.
     *
     * @param account The SEPA account to fetch the balance for.
     * @param existingDialog Optionally reuse an already authenticated dialog instance.
     *
     * @return The balance of the given SEPA account.
     */
    public async balance(account: SEPAAccount, existingDialog?: Dialog): Promise<Balance> {
        const dialog = existingDialog ?? this.createDialog();
        const shouldInitializeDialog = !existingDialog;
        if (shouldInitializeDialog) {
            await dialog.sync();
            await dialog.init();
        }
        let touchdowns: Map<string, string>;
        let touchdown: string | undefined;
        const responses: Response[] = [];
        do {
            const request = this.createRequest(dialog, [
                new HKSAL({
                    segNo: 3,
                    version: dialog.hisalsVersion,
                    account,
                    touchdown,
                }),
            ]);
            const response = await dialog.send(request);
            touchdowns = response.getTouchdowns(request);
            touchdown = touchdowns.get("HKSAL");
            responses.push(response);
        } while (touchdown);
        if (shouldInitializeDialog) {
            await dialog.end();
        }
        const segments: HISAL[] = responses.reduce((result, response: Response) => {
            result.push(...response.findSegments(HISAL));
            return result;
        }, []);
        const hisal: HISAL = segments.find(
            (s) => s.account.accountNumber === account.accountNumber && s.account.blz === account.blz,
        );
        return {
            account,
            availableBalance: hisal.availableBalance,
            bookedBalance: hisal.bookedBalance,
            currency: hisal.currency,
            creditLimit: hisal.creditLimit,
            pendingBalance: hisal.pendingBalance,
            productName: hisal.productName,
        };
    }

    /**
     * Fetch the list of holdings for a depot account.
     *
     * @param account The account to fetch holdings for.
     * @param existingDialog Optionally reuse an already authenticated dialog instance.
     *
     * @return A list of holdings contained in the depot.
     */
    public async holdings(account: SEPAAccount, existingDialog?: Dialog): Promise<Holding[]> {
        const dialog = existingDialog ?? this.createDialog();
        const shouldInitializeDialog = !existingDialog;
        if (shouldInitializeDialog) {
            await dialog.sync();
        }
        if (!dialog.hiwpdsVersion) {
            throw new Error("Holdings are not supported by this bank.");
        }
        if (shouldInitializeDialog) {
            await dialog.init();
        }
        let touchdowns: Map<string, string>;
        let touchdown: string | undefined;
        const responses: Response[] = [];
        do {
            const request = this.createRequest(dialog, [
                new HKWPD({
                    segNo: 3,
                    version: dialog.hiwpdsVersion,
                    account,
                    touchdown,
                }),
            ]);
            const response = await dialog.send(request);
            touchdowns = response.getTouchdowns(request);
            touchdown = touchdowns.get("HKWPD");
            responses.push(response);
        } while (touchdown);
        if (shouldInitializeDialog) {
            await dialog.end();
        }
        const parser = new MT535Parser();
        return responses.reduce((result: Holding[], response: Response) => {
            response.findSegments(HIWPD).forEach((segment) => {
                const raw = segment.holdings;
                if (!raw) { return; }
                const lines = raw.split(/\r?\n/);
                if (lines.length > 0 && lines[0] === "") {
                    lines.shift();
                }
                result.push(...parser.parse(lines));
            });
            return result;
        }, []);
    }

    /**
     * Fetch a list of bank statements deserialized from the MT940 transmitted by the fints server.
     *
     * @param startDate The start of the range for which the statements should be fetched.
     * @param endDate The end of the range for which the statements should be fetched.
     * @param existingDialog Optionally reuse an already authenticated dialog instance.
     *
     * @return A list of all statements in the specified range.
     */
    public async statements(
        account: SEPAAccount,
        startDate?: Date,
        endDate?: Date,
        existingDialog?: Dialog,
    ): Promise<Statement[]> {
        const dialog = existingDialog ?? this.createDialog();
        const shouldInitializeDialog = !existingDialog;
        if (shouldInitializeDialog) {
            await dialog.sync();
            await dialog.init();
        }
        const segments: Segment<any>[] = [];
        segments.push(
            new HKKAZ({
                segNo: 3,
                version: dialog.hikazsVersion,
                account,
                startDate,
                endDate,
            }),
        );
        if (dialog.hktanVersion >= 6) {
            const version = dialog.hktanVersion >= 7 ? 7 : 6;
            segments.push(
                new HKTAN({
                    segNo: 4,
                    version,
                    process: "4",
                    segmentReference: "HKKAZ",
                    medium: dialog.tanMethods[0].name,
                }),
            );
        }
        return await this.sendStatementRequest(dialog, segments, undefined, shouldInitializeDialog);
    }

    /**
     * Fetch a list of bank statements deserialized from the MT940 transmitted by the fints server.
     *
     * @param startDate The start of the range for which the statements should be fetched.
     * @param endDate The end of the range for which the statements should be fetched.
     *
     * @return A list of all statements in the specified range.
     */
    public async completeStatements(
        savedDialog: DialogConfig,
        transactionReference: string,
        tan: string,
    ): Promise<Statement[]> {
        const dialog = this.createDialog(savedDialog);
        dialog.msgNo = dialog.msgNo + 1;
        const segments: Segment<any>[] = [];
        const version = dialog.hktanVersion >= 7 ? 7 : 6;
        segments.push(
            new HKTAN({
                segNo: 3,
                version,
                process: "2",
                segmentReference: "HKKAZ",
                aref: transactionReference,
                medium: dialog.tanMethods[0].name,
            }),
        );
        return await this.sendStatementRequest(dialog, segments, tan);
    }

    /**
     * Complete a login flow that has been interrupted by a TAN challenge.
     *
     * @param savedDialog The dialog data returned with the {@link TanRequiredError}.
     * @param transactionReference The transaction reference from the challenge message.
     * @param tan The TAN that should be used to authorize the login.
     *
     * @return A dialog that can be reused to continue the original request. The caller is responsible for ending the dialog
     * once no further messages should be sent.
     */
    public async completeLogin(
        savedDialog: DialogConfig,
        transactionReference: string,
        tan: string,
    ): Promise<Dialog> {
        const dialog = this.createDialog(savedDialog);
        dialog.msgNo = dialog.msgNo + 1;
        const version = dialog.hktanVersion >= 7 ? 7 : 6;
        const segments: Segment<any>[] = [
            new HKTAN({
                segNo: 3,
                version,
                process: "2",
                segmentReference: "HKIDN",
                aref: transactionReference,
                medium: dialog.tanMethods[0].name,
            }),
        ];
        await dialog.send(this.createRequest(dialog, segments, tan));
        return dialog;
    }

    private async sendStatementRequest(
        dialog: Dialog,
        segments: Segment<any>[],
        tan?: string,
        shouldEndDialog = true,
    ): Promise<Statement[]> {
        let touchdowns: Map<string, string>;
        let touchdown: string;
        const responses: Response[] = [];
        do {
            const request = this.createRequest(dialog, segments, tan);
            const response = await dialog.send(request);
            touchdowns = response.getTouchdowns(request);
            touchdown = touchdowns.get("HKKAZ");
            responses.push(response);
        } while (touchdown);
        if (shouldEndDialog) {
            await dialog.end();
        }
        const responseSegments: HIKAZ[] = responses.reduce((result, response: Response) => {
            result.push(...response.findSegments(HIKAZ));
            return result;
        }, []);
        const bookedString = responseSegments.map((segment) => segment.bookedTransactions || "").join("");
        const unprocessedStatements = await read(Buffer.from(bookedString, "utf-8"));
        return unprocessedStatements.map((statement) => {
            const transactions = statement.transactions.map((transaction) => {
                const descriptionStructured = parse86Structured(transaction.description);
                return { ...transaction, descriptionStructured };
            });
            return { ...statement, transactions };
        });
    }

    /**
     * Fetch a list of standing orders for the given account.
     *
     * @param account The account to fetch standing orders for.
     * @param existingDialog Optionally reuse an already authenticated dialog instance.
     *
     * @return A list of all standing orders for the given account.
     */
    public async standingOrders(account: SEPAAccount, existingDialog?: Dialog): Promise<StandingOrder[]> {
        const dialog = existingDialog ?? this.createDialog();
        const shouldInitializeDialog = !existingDialog;
        if (shouldInitializeDialog) {
            await dialog.sync();
            await dialog.init();
        }
        let touchdowns: Map<string, string>;
        let touchdown: string;
        const responses: Response[] = [];
        do {
            const request = this.createRequest(dialog, [
                new HKCDB({
                    segNo: 3,
                    version: dialog.hicdbVersion,
                    account,
                    painFormats: dialog.painFormats,
                    touchdown,
                }),
            ]);
            const response = await dialog.send(request);
            touchdowns = response.getTouchdowns(request);
            touchdown = touchdowns.get("HKCDB");
            responses.push(response);
        } while (touchdown);
        if (shouldInitializeDialog) {
            await dialog.end();
        }
        const segments: HICDB[] = responses.reduce((result, response: Response) => {
            result.push(...response.findSegments(HICDB));
            return result;
        }, []);

        return segments.map((s) => s.standingOrder);
    }
}
