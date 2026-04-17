/**
 * FinTS 4.1 Client implementation.
 *
 * Provides read-only operations using the FinTS 4.1 XML-based protocol:
 * - Account listing
 * - Balance queries
 * - Account statements (using camt.053 format)
 *
 * This client follows the same patterns as the existing PinTanClient but uses
 * XML messages conforming to the FinTS 4.1 specification.
 */
import { FinTS4ClientConfig, FinTS4Connection, CamtStatement } from "./types";
import { FinTS4Dialog } from "./dialog";
import { FinTS4HttpConnection, createTlsAgent } from "./connection";
import {
    SEPAAccount,
    Balance,
    Statement,
    BankCapabilities,
    Holding,
    StandingOrder,
    CreditTransferRequest,
    CreditTransferSubmission,
    DirectDebitRequest,
    DirectDebitSubmission,
} from "../types";
import { PRODUCT_NAME } from "../constants";
import { parseCamt053 } from "./camt-parser";
import {
    buildAccountListSegment,
    buildBalanceSegment,
    buildAccountStatementSegment,
    buildTanSegment,
    buildHoldingsSegment,
    buildStandingOrdersSegment,
    buildCreditTransferSegment,
    buildDirectDebitSegment,
} from "./segments";
import { XmlSegment } from "./xml-builder";
import {
    selectPain001Descriptor,
    selectPain008Descriptor,
    buildCreditTransferSubmission,
    buildDirectDebitSubmission,
} from "../pain";

/**
 * Client for FinTS 4.1 XML-based protocol.
 *
 * Supports read-only operations:
 * - Listing SEPA accounts
 * - Querying account balances
 * - Fetching account statements (camt.053 format)
 * - Retrieving bank capabilities
 */
export class FinTS4Client {
    private config: FinTS4ClientConfig;
    private connection: FinTS4Connection;

    constructor(config: FinTS4ClientConfig) {
        this.config = config;
        // If tlsOptions is provided directly, convert it to an agent and merge into fetchOptions.
        // This spares callers from having to manually call createTlsAgent().
        let fetchOptions = config.fetchOptions ?? {};
        if (config.tlsOptions && !fetchOptions["agent"]) {
            try {
                fetchOptions = { ...fetchOptions, agent: createTlsAgent(config.tlsOptions) };
            } catch {
                // Not in a Node.js environment — tlsOptions silently ignored.
            }
        }
        this.connection = new FinTS4HttpConnection({
            url: config.url,
            debug: config.debug,
            timeout: config.timeout,
            maxRetries: config.maxRetries,
            retryDelay: config.retryDelay,
            fetchOptions,
        });
    }

    /**
     * Create a new FinTS 4.1 dialog.
     */
    public createDialog(): FinTS4Dialog {
        const dialog = new FinTS4Dialog(
            {
                blz: this.config.blz,
                name: this.config.name,
                pin: this.config.pin,
                systemId: "0",
                productId: this.config.productId || PRODUCT_NAME,
                tanCallback: this.config.tanCallback,
            },
            this.connection,
        );
        if (this.config.preferredHbciVersion) {
            dialog.hbciVersion = this.config.preferredHbciVersion;
        }
        return dialog;
    }

    /**
     * Retrieve the capabilities of the bank.
     */
    public async capabilities(): Promise<BankCapabilities> {
        const dialog = this.createDialog();
        await dialog.sync();
        return dialog.capabilities;
    }

    /**
     * Fetch a list of all SEPA accounts accessible by the user.
     */
    public async accounts(): Promise<SEPAAccount[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const response = await dialog.send([buildAccountListSegment({ segNo: 3 })]);
        await dialog.end();

        return response.accounts || [];
    }

    /**
     * Fetch the balance for a SEPA account.
     */
    public async balance(account: SEPAAccount): Promise<Balance> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const response = await dialog.send(
            [
                buildBalanceSegment({
                    segNo: 3,
                    version: dialog.balanceVersion,
                    account,
                }),
            ],
            { account },
        );
        await dialog.end();

        if (response.balance) {
            return response.balance;
        }

        // Fallback: return a zeroed balance so callers always receive a Balance object
        return {
            account,
            availableBalance: 0,
            bookedBalance: 0,
            currency: "EUR",
            creditLimit: 0,
            pendingBalance: 0,
            productName: "",
        };
    }

    /**
     * Fetch account statements in camt.053 format.
     *
     * Returns parsed camt statements with transaction entries.
     */
    public async camtStatements(account: SEPAAccount, startDate?: Date, endDate?: Date): Promise<CamtStatement[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const allStatements: CamtStatement[] = [];
        let touchdown: string | undefined;

        do {
            const segments: XmlSegment[] = [
                buildAccountStatementSegment({
                    segNo: 3,
                    version: dialog.statementVersion,
                    account,
                    startDate,
                    endDate,
                    touchdown,
                }),
            ];

            // Add TAN segment if required
            if (dialog.tanVersion >= 1 && dialog.tanMethods.length > 0 && !touchdown) {
                segments.push(
                    buildTanSegment({
                        segNo: 4,
                        version: dialog.tanVersion,
                        process: "4",
                        segmentReference: "AccountStatement",
                        medium: dialog.tanMethods[0]?.name,
                    }),
                );
            }

            const response = await dialog.send(segments);

            if (response.camtData) {
                const parsed = parseCamt053(response.camtData);
                allStatements.push(...parsed);
            }

            touchdown = response.touchdown;
        } while (touchdown);

        await dialog.end();
        return allStatements;
    }

    /**
     * Fetch account statements and convert them to the common Statement format
     * used by the FinTS 3.0 client for backward compatibility.
     */
    public async statements(account: SEPAAccount, startDate?: Date, endDate?: Date): Promise<Statement[]> {
        const camtStatements = await this.camtStatements(account, startDate, endDate);
        return this.convertCamtToStatements(camtStatements);
    }

    /**
     * Fetch holdings for a depot account.
     */
    public async holdings(account: SEPAAccount): Promise<Holding[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const allHoldings: Holding[] = [];
        let touchdown: string | undefined;

        do {
            const response = await dialog.send([
                buildHoldingsSegment({
                    segNo: 3,
                    version: dialog.holdingsVersion,
                    account,
                    touchdown,
                }),
            ]);
            allHoldings.push(...(response.holdings || []));
            touchdown = response.touchdown;
        } while (touchdown);

        await dialog.end();
        return allHoldings;
    }

    /**
     * Fetch standing orders for an account.
     */
    public async standingOrders(account: SEPAAccount): Promise<StandingOrder[]> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const allOrders: StandingOrder[] = [];
        let touchdown: string | undefined;

        do {
            const response = await dialog.send([
                buildStandingOrdersSegment({
                    segNo: 3,
                    version: dialog.standingOrdersVersion,
                    account,
                    painFormats: dialog.painFormats,
                    touchdown,
                }),
            ]);
            allOrders.push(...(response.standingOrders || []));
            touchdown = response.touchdown;
        } while (touchdown);

        await dialog.end();
        return allOrders;
    }

    /**
     * Submit a SEPA credit transfer.
     */
    public async creditTransfer(account: SEPAAccount, request: CreditTransferRequest): Promise<CreditTransferSubmission> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const descriptor = selectPain001Descriptor(dialog.painFormats);
        const submission = buildCreditTransferSubmission(request, account, descriptor);
        const segments: XmlSegment[] = [
            buildCreditTransferSegment({
                segNo: 3,
                version: dialog.creditTransferVersion,
                account,
                painDescriptor: descriptor,
                painMessage: submission.xml,
            }),
        ];
        if (dialog.tanVersion >= 1 && dialog.tanMethods.length > 0) {
            segments.push(
                buildTanSegment({
                    segNo: 4,
                    version: dialog.tanVersion,
                    process: "4",
                    segmentReference: "CreditTransfer",
                    medium: dialog.tanMethods[0]?.name,
                }),
            );
        }

        const response = await dialog.send(segments);
        if (response.taskId) {
            submission.taskId = response.taskId;
        }
        await dialog.end();
        return submission;
    }

    /**
     * Submit a SEPA direct debit.
     */
    public async directDebit(account: SEPAAccount, request: DirectDebitRequest): Promise<DirectDebitSubmission> {
        const dialog = this.createDialog();
        await dialog.sync();
        await dialog.init();

        const descriptor = selectPain008Descriptor(dialog.painFormats);
        const submission = buildDirectDebitSubmission(request, account, descriptor);
        const segments: XmlSegment[] = [
            buildDirectDebitSegment({
                segNo: 3,
                version: dialog.directDebitVersion,
                account,
                painDescriptor: descriptor,
                painMessage: submission.xml,
            }),
        ];
        if (dialog.tanVersion >= 1 && dialog.tanMethods.length > 0) {
            segments.push(
                buildTanSegment({
                    segNo: 4,
                    version: dialog.tanVersion,
                    process: "4",
                    segmentReference: "DirectDebit",
                    medium: dialog.tanMethods[0]?.name,
                }),
            );
        }

        const response = await dialog.send(segments);
        if (response.taskId) {
            submission.taskId = response.taskId;
        }
        await dialog.end();
        return submission;
    }

    /**
     * Convert a balance value to the MT940 BalanceInfo format.
     */
    private toBalanceInfo(
        amount: number,
        date: Date | undefined,
        currency: string,
    ): { isCredit: boolean; date: string; currency: string; value: number } {
        return {
            isCredit: amount >= 0,
            date: date ? date.toISOString().slice(0, 10) : "",
            currency,
            value: Math.abs(amount),
        };
    }

    /**
     * Convert camt statements to the common Statement format for compatibility
     * with the FinTS 3.0 MT940-based statements.
     */
    private convertCamtToStatements(camtStatements: CamtStatement[]): Statement[] {
        return camtStatements.map((stmt) => {
            const currency = stmt.currency || "EUR";
            return {
                referenceNumber: stmt.id,
                accountId: stmt.iban || "",
                number: stmt.id,
                openingBalance:
                    stmt.openingBalance != null
                        ? this.toBalanceInfo(stmt.openingBalance, stmt.creationDate, currency)
                        : undefined,
                closingBalance:
                    stmt.closingBalance != null
                        ? this.toBalanceInfo(stmt.closingBalance, stmt.creationDate, currency)
                        : undefined,
                transactions: stmt.entries.map((entry) => ({
                    id: entry.entryReference || "",
                    code: entry.bankTransactionCode || "",
                    fundsCode: "",
                    isCredit: entry.creditDebitIndicator === "CRDT",
                    isExpense: entry.creditDebitIndicator === "DBIT",
                    currency: entry.currency,
                    description: entry.remittanceInformation || "",
                    amount: Math.abs(entry.amount),
                    valueDate: entry.valueDate ? entry.valueDate.toISOString().slice(0, 10) : "",
                    entryDate: entry.bookingDate ? entry.bookingDate.toISOString().slice(0, 10) : "",
                    customerReference: entry.endToEndReference || "",
                    bankReference: "",
                    descriptionStructured: entry.counterpartyName
                        ? {
                              reference: {
                                  raw: entry.remittanceInformation || "",
                                  endToEndRef: entry.endToEndReference,
                                  mandateRef: entry.mandateReference,
                                  iban: entry.counterpartyIban,
                                  bic: entry.counterpartyBic,
                                  text: entry.remittanceInformation,
                              },
                              name: entry.counterpartyName || "",
                              iban: entry.counterpartyIban || "",
                              bic: entry.counterpartyBic || "",
                              text: entry.remittanceInformation || "",
                              primaNota: "",
                          }
                        : undefined,
                })),
            };
        });
    }
}
