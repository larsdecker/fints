import { Holding } from "./types";

interface FinancialInstrumentContext {
    isin?: string;
    name?: string;
    marketPrice?: number;
    currency?: string;
    valuationDate?: Date;
    pieces?: number;
    totalValue?: number;
    acquisitionPrice?: number;
}

/**
 * Parser for holdings information encoded in MT535 statements.
 */
export class MT535Parser {
    private readonly identification = /^:35B:ISIN\s(.*)\|(.*)\|(.*)$/;
    private readonly marketPrice = /^:90B::MRKT\/\/ACTU\/([A-Z]{3})(\d*),{1}(\d*)$/;
    private readonly priceDate = /^:98A::PRIC\/\/(\d*)$/;
    private readonly pieces = /^:93B::AGGR\/\/UNIT\/(\d*),(\d*)$/;
    private readonly totalValue = /^:19A::HOLD\/\/([A-Z]{3})(\d*),{1}(\d*)$/;
    private readonly acquisitionPrice = /^:70E::HOLD\/\/\d*STK\|2(\d*?),{1}(\d*?)\+([A-Z]{3})$/;

    public parse(lines: string[]): Holding[] {
        if (!lines || lines.length === 0) {
            return [];
        }

        const clauses = this.collapseMultilines(lines);
        const financialInstrumentSegments = this.grabFinancialInstrumentSegments(clauses);
        return financialInstrumentSegments.reduce<Holding[]>((result, segment) => {
            const holding = this.parseFinancialInstrument(segment);
            if (holding) {
                result.push(holding);
            }
            return result;
        }, []);
    }

    private parseFinancialInstrument(segment: string[]): Holding | undefined {
        const context: FinancialInstrumentContext = {};
        segment.forEach((clause) => this.parseClause(clause, context));
        if (Object.keys(context).length === 0) {
            return undefined;
        }
        return {
            isin: context.isin,
            name: context.name,
            marketPrice: context.marketPrice,
            currency: context.currency,
            valuationDate: context.valuationDate,
            pieces: context.pieces,
            totalValue: context.totalValue,
            acquisitionPrice: context.acquisitionPrice,
        };
    }

    private parseClause(clause: string, context: FinancialInstrumentContext) {
        let match = this.identification.exec(clause);
        if (match) {
            context.isin = match[1];
            context.name = match[3];
            return;
        }

        match = this.marketPrice.exec(clause);
        if (match) {
            context.currency = match[1];
            context.marketPrice = this.parseDecimal(match[2], match[3]);
            return;
        }

        match = this.priceDate.exec(clause);
        if (match) {
            context.valuationDate = this.parseDate(match[1]);
            return;
        }

        match = this.pieces.exec(clause);
        if (match) {
            context.pieces = this.parseDecimal(match[1], match[2]);
            return;
        }

        match = this.totalValue.exec(clause);
        if (match) {
            context.totalValue = this.parseDecimal(match[2], match[3]);
            if (!context.currency) {
                context.currency = match[1];
            }
            return;
        }

        match = this.acquisitionPrice.exec(clause);
        if (match) {
            context.acquisitionPrice = this.parseDecimal(match[1], match[2]);
        }
    }

    private parseDecimal(integerPart: string, fractionPart: string): number {
        const integer = integerPart || "0";
        const fraction = fractionPart || "0";
        return parseFloat(`${integer}.${fraction}`);
    }

    private parseDate(raw: string): Date | undefined {
        if (!raw || raw.length !== 8) {
            return undefined;
        }
        const year = Number(raw.substr(0, 4));
        const month = Number(raw.substr(4, 2));
        const day = Number(raw.substr(6, 2));
        if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
            return undefined;
        }
        return new Date(Date.UTC(year, month - 1, day));
    }

    private collapseMultilines(lines: string[]): string[] {
        const clauses: string[] = [];
        let previous = "";
        for (const line of lines) {
            if (line.startsWith(":")) {
                if (previous !== "") {
                    clauses.push(previous);
                }
                previous = line;
            } else if (line.startsWith("-")) {
                if (previous !== "") {
                    clauses.push(previous);
                }
                clauses.push(line);
                previous = "";
            } else if (previous) {
                previous += `|${line}`;
            } else {
                previous = line;
            }
        }
        if (previous) {
            clauses.push(previous);
        }
        return clauses;
    }

    private grabFinancialInstrumentSegments(clauses: string[]): string[][] {
        const segments: string[][] = [];
        let stack: string[] = [];
        let withinInstrument = false;
        clauses.forEach((clause) => {
            if (clause.startsWith(":16R:FIN")) {
                withinInstrument = true;
                stack = [];
            } else if (clause.startsWith(":16S:FIN")) {
                if (withinInstrument) {
                    segments.push(stack.slice());
                }
                withinInstrument = false;
                stack = [];
            } else if (withinInstrument) {
                stack.push(clause);
            }
        });
        return segments;
    }
}
