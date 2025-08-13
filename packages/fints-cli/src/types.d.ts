declare module "fints" {
    export const PRODUCT_NAME: string;
    export type PinTanClientConfig = any;
    export class PinTanClient {
        constructor(config: any);
        accounts(): Promise<any[]>;
        statements(account: any, start: Date, end: Date): Promise<any[]>;
    }
    export const logger: any;
}
