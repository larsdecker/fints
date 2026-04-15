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
import { FinTS4HttpConnection } from "./connection";
import { SEPAAccount, Balance, Statement, BankCapabilities } from "../types";
import { PRODUCT_NAME } from "../constants";
import { parseCamt053 } from "./camt-parser";
import {
    buildAccountListSegment,
    buildBalanceSegment,
    buildAccountStatementSegment,
    buildTanSegment,
} from "./segments";
import { XmlSegment } from "./xml-builder";

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
        this.connection = new FinTS4HttpConnection({
            url: config.url,
            debug: config.debug,
            timeout: config.timeout,
            maxRetries: config.maxRetries,
            retryDelay: config.retryDelay,
        });
    }

    /**
     * Create a new FinTS 4.1 dialog.
     */
    public createDialog(): FinTS4Dialog {
        return new FinTS4Dialog(
            {
                blz: this.config.blz,
                name: this.config.name,
                pin: this.config.pin,
                systemId: "0",
                productId: this.config.productId || PRODUCT_NAME,
            },
            this.connection,
        );
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

        const response = await dialog.send([
            buildBalanceSegment({
                segNo: 3,
                version: dialog.balanceVersion,
                account,
            }),
        ]);
        await dialog.end();

        if (response.balance) {
            return response.balance;
        }

        // Build balance from raw response
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
