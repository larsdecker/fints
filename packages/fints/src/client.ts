import "isomorphic-fetch";
import { Dialog, DialogConfig } from "./dialog";
import { Parse } from "./parse";
import { Format } from "./format";
import { buildStandingOrderPain001 } from "./pain-formats";
import {
    Segment,
    HKSPA,
    HISPA,
    HKKAZ,
    HIKAZ,
    HKSAL,
    HISAL,
    HKCDB,
    HICDB,
    HKTAN,
    HKWPD,
    HIWPD,
    HKCDA,
    HICDA,
    HKCDE,
    HICDE,
    HKCDL,
    HICDL,
} from "./segments";
import { Request } from "./request";
import { Response } from "./response";
import {
    SEPAAccount,
    Statement,
    Balance,
    StandingOrder,
    StandingOrderCreation,
    StandingOrderUpdate,
    StandingOrderCommandResult,
    StandingOrderSchedule,
    Holding,
} from "./types";
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
     * @return An array of all SEPA accounts.
     */
    public async accounts(): Promise<SEPAAccount[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        const response = await dialog.send(this.createRequest(dialog, [new HKSPA({ segNo: 3 })]));
        await dialog.end();
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
     *
     * @return The balance of the given SEPA account.
     */
    public async balance(account: SEPAAccount): Promise<Balance> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
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
        await dialog.end();
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
     *
     * @return A list of holdings contained in the depot.
     */
    public async holdings(account: SEPAAccount): Promise<Holding[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        if (!dialog.hiwpdsVersion) {
            throw new Error("Holdings are not supported by this bank.");
        }
        await dialog.init();
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
        await dialog.end();
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
     *
     * @return A list of all statements in the specified range.
     */
    public async statements(account: SEPAAccount, startDate?: Date, endDate?: Date): Promise<Statement[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
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
        return await this.sendStatementRequest(dialog, segments);
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

    private async sendStatementRequest(dialog: Dialog, segments: Segment<any>[], tan?: string): Promise<Statement[]> {
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
        await dialog.end();
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

    private resolvePainDescriptor(dialog: Dialog): string {
        const preferred = dialog.painFormats.find((format) => format.includes("pain.001.001.03"));
        const fallback = dialog.painFormats.find((format) => format.includes("pain.001.003.03"));
        return preferred || fallback || Format.sepaDescriptor();
    }

    private prepareStandingOrderPayment(account: SEPAAccount, payment: StandingOrderCreation["payment"]) {
        if (payment.debitor) { return payment; }
        return {
            ...payment,
            debitor: {
                name: account.accountOwnerName || account.accountName || "",
                iban: account.iban,
                bic: account.bic,
            },
        };
    }

    private standingOrderToSchedule(order: StandingOrder): StandingOrderSchedule {
        return {
            startDate: order.nextOrderDate,
            timeUnit: order.timeUnit,
            interval: order.interval,
            executionDay: order.orderDay,
            endDate: order.lastOrderDate || undefined,
        };
    }

    private standingOrderToPayment(order: StandingOrder) {
        return {
            amount: order.amount,
            purpose: order.paymentPurpose,
            creditor: order.creditor,
            debitor: order.debitor,
            currency: order.currency,
        };
    }

    private addInitialTanSegment(dialog: Dialog, segments: Segment<any>[], segmentReference: string) {
        if (dialog.hktanVersion >= 6) {
            const version = dialog.hktanVersion >= 7 ? 7 : dialog.hktanVersion;
            const segNo = (segments[0]?.segNo || 2) + segments.length;
            segments.push(new HKTAN({
                segNo,
                version,
                process: "4",
                segmentReference,
                aref: "",
                medium: dialog.tanMethods.length > 0 ? dialog.tanMethods[0].name : "",
            }));
        }
    }

    private async completeStandingOrder(dialogConfig: DialogConfig, segmentReference: string, transactionReference: string, tan: string) {
        const dialog = this.createDialog(dialogConfig);
        dialog.msgNo = dialog.msgNo + 1;
        const version = dialog.hktanVersion >= 7 ? 7 : dialog.hktanVersion;
        const segments: Segment<any>[] = [
            new HKTAN({
                segNo: 3,
                version,
                process: "2",
                segmentReference,
                aref: transactionReference,
                medium: dialog.tanMethods.length > 0 ? dialog.tanMethods[0].name : "",
            }),
        ];
        const response = await dialog.send(this.createRequest(dialog, segments, tan));
        await dialog.end();
        return response;
    }

    private extractStandingOrderResult(segment: { standingOrder: StandingOrder }): StandingOrderCommandResult {
        const { standingOrder } = segment;
        return {
            orderId: standingOrder.orderId || "",
            standingOrder,
        };
    }

    public async createStandingOrder(account: SEPAAccount, order: StandingOrderCreation): Promise<StandingOrderCommandResult> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        const payment = this.prepareStandingOrderPayment(account, order.payment);
        const sepaMessage = buildStandingOrderPain001({ account, payment, schedule: order.schedule });
        const segments: Segment<any>[] = [
            new HKCDA({
                segNo: 3,
                version: 1,
                account,
                painDescriptor: this.resolvePainDescriptor(dialog),
                sepaMessage,
                schedule: order.schedule,
            }),
        ];
        this.addInitialTanSegment(dialog, segments, "HKCDA");
        const response = await dialog.send(this.createRequest(dialog, segments));
        await dialog.end();
        const ack = response.findSegment(HICDA);
        return this.extractStandingOrderResult(ack);
    }

    public async completeCreateStandingOrder(savedDialog: DialogConfig, transactionReference: string, tan: string): Promise<StandingOrderCommandResult> {
        const response = await this.completeStandingOrder(savedDialog, "HKCDA", transactionReference, tan);
        const ack = response.findSegment(HICDA);
        return this.extractStandingOrderResult(ack);
    }

    public async updateStandingOrder(account: SEPAAccount, update: StandingOrderUpdate): Promise<StandingOrderCommandResult> {
        if (!update.orderId) { throw new Error("orderId is required for updateStandingOrder"); }
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        const payment = this.prepareStandingOrderPayment(account, update.payment);
        const sepaMessage = buildStandingOrderPain001({ account, payment, schedule: update.schedule });
        const segments: Segment<any>[] = [
            new HKCDE({
                segNo: 3,
                version: 1,
                account,
                painDescriptor: this.resolvePainDescriptor(dialog),
                sepaMessage,
                schedule: update.schedule,
                orderId: update.orderId,
            }),
        ];
        this.addInitialTanSegment(dialog, segments, "HKCDE");
        const response = await dialog.send(this.createRequest(dialog, segments));
        await dialog.end();
        const ack = response.findSegment(HICDE);
        return this.extractStandingOrderResult(ack);
    }

    public async completeUpdateStandingOrder(savedDialog: DialogConfig, transactionReference: string, tan: string): Promise<StandingOrderCommandResult> {
        const response = await this.completeStandingOrder(savedDialog, "HKCDE", transactionReference, tan);
        const ack = response.findSegment(HICDE);
        return this.extractStandingOrderResult(ack);
    }

    public async cancelStandingOrder(account: SEPAAccount, order: StandingOrder): Promise<StandingOrderCommandResult> {
        if (!order.orderId) { throw new Error("orderId is required for cancelStandingOrder"); }
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
        const schedule = this.standingOrderToSchedule(order);
        const payment = this.prepareStandingOrderPayment(account, this.standingOrderToPayment(order));
        const sepaMessage = buildStandingOrderPain001({ account, payment, schedule });
        const segments: Segment<any>[] = [
            new HKCDL({
                segNo: 3,
                version: 1,
                account,
                painDescriptor: this.resolvePainDescriptor(dialog),
                sepaMessage,
                schedule,
                orderId: order.orderId,
            }),
        ];
        this.addInitialTanSegment(dialog, segments, "HKCDL");
        const response = await dialog.send(this.createRequest(dialog, segments));
        await dialog.end();
        const ack = response.findSegment(HICDL);
        return this.extractStandingOrderResult(ack);
    }

    public async completeCancelStandingOrder(savedDialog: DialogConfig, transactionReference: string, tan: string): Promise<StandingOrderCommandResult> {
        const response = await this.completeStandingOrder(savedDialog, "HKCDL", transactionReference, tan);
        const ack = response.findSegment(HICDL);
        return this.extractStandingOrderResult(ack);
    }

    /**
     * Fetch a list of standing orders for the given account.
     *
     * @param account The account to fetch standing orders for.
     *
     * @return A list of all standing orders for the given account.
     */
    public async standingOrders(account: SEPAAccount): Promise<StandingOrder[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();
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
        await dialog.end();
        const segments: HICDB[] = responses.reduce((result, response: Response) => {
            result.push(...response.findSegments(HICDB));
            return result;
        }, []);

        return segments.map((s) => s.standingOrder);
    }
}
