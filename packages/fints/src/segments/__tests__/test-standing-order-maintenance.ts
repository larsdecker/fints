import { Format } from "../../format";
import { buildStandingOrderPain001 } from "../../pain-formats";
import { StandingOrderCreation } from "../../types";
import { HKCDA } from "../hkcda";
import { HICDA } from "../hicda";
import { HKCDE } from "../hkcde";
import { HICDE } from "../hicde";
import { HKCDL } from "../hkcdl";
import { HICDL } from "../hicdl";
import { serializeStandingOrderSchedule } from "../standing-order-utils";
import { testSegment } from "./utils";

const creation: StandingOrderCreation = {
    payment: {
        amount: 90.2,
        purpose: "Common Order",
        creditor: {
            name: "John Doe",
            iban: "DE58140369180198038800",
            bic: "DEU1GFAS800",
        },
        debitor: {
            name: "Max Mustermann",
            iban: "DE27100777770209299700",
            bic: "DEUTDEFF500",
        },
        currency: "EUR",
        endToEndId: "NOTPROVIDED",
    },
    schedule: {
        startDate: new Date("2019-01-31T00:00:00Z"),
        timeUnit: "M",
        interval: 1,
        executionDay: 29,
        endDate: new Date("2020-06-30T00:00:00Z"),
    },
};

const account = {
    iban: "DE27100777770209299700",
    bic: "DEUTDEFF500",
    blz: "12345678",
    accountNumber: "0123456789",
};

const sepaMessage = buildStandingOrderPain001({ account: account as any, payment: creation.payment, schedule: creation.schedule });
const scheduleString = serializeStandingOrderSchedule(creation.schedule).join(":");
const descriptor = Format.sepaDescriptor();
const baseHeader = `${account.iban}:${account.bic}`;

const hicExpected = {
    nextOrderDate: new Date("2019-01-31T00:00:00.000Z"),
    timeUnit: "M",
    interval: 1,
    orderDay: 29,
    lastOrderDate: new Date("2020-06-30T00:00:00.000Z"),
    creationDate: creation.schedule.startDate,
    amount: creation.payment.amount,
    paymentPurpose: creation.payment.purpose,
    debitor: creation.payment.debitor!,
    creditor: creation.payment.creditor,
    currency: creation.payment.currency,
};

const orderId = "97841129195143109616";

const serializedAdd = `HKCDA:3:1+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${Format.empty()}+${scheduleString}'`;
const serializedAddResponse = `HICDA:4:1:3+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${orderId}+${scheduleString}'`;
const serializedChange = `HKCDE:3:1+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${orderId}+${scheduleString}'`;
const serializedChangeResponse = `HICDE:4:1:3+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${orderId}+${scheduleString}'`;
const serializedDelete = `HKCDL:3:1+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${orderId}+${scheduleString}'`;
const serializedDeleteResponse = `HICDL:4:1:3+${baseHeader}+${descriptor}+${Format.stringWithLength(sepaMessage)}+${orderId}+${scheduleString}'`;

testSegment(
    HKCDA,
    [
        {
            serialized: serializedAdd,
            structured: {
                type: "HKCDA",
                segNo: 3,
                version: 1,
                account,
                sepaMessage,
                schedule: creation.schedule,
                painDescriptor: descriptor,
            },
        },
    ],
    "out",
);

testSegment(
    HICDA,
    [
        {
            serialized: serializedAddResponse,
            structured: {
                type: "HICDA",
                segNo: 4,
                version: 1,
                reference: 3,
                standingOrder: { ...hicExpected, orderId },
            },
        },
    ],
    "in",
);

testSegment(
    HKCDE,
    [
        {
            serialized: serializedChange,
            structured: {
                type: "HKCDE",
                segNo: 3,
                version: 1,
                account,
                sepaMessage,
                schedule: creation.schedule,
                painDescriptor: descriptor,
                orderId,
            },
        },
    ],
    "out",
);

testSegment(
    HICDE,
    [
        {
            serialized: serializedChangeResponse,
            structured: {
                type: "HICDE",
                segNo: 4,
                version: 1,
                reference: 3,
                standingOrder: { ...hicExpected, orderId },
            },
        },
    ],
    "in",
);

testSegment(
    HKCDL,
    [
        {
            serialized: serializedDelete,
            structured: {
                type: "HKCDL",
                segNo: 3,
                version: 1,
                account,
                sepaMessage,
                schedule: creation.schedule,
                painDescriptor: descriptor,
                orderId,
            },
        },
    ],
    "out",
);

testSegment(
    HICDL,
    [
        {
            serialized: serializedDeleteResponse,
            structured: {
                type: "HICDL",
                segNo: 4,
                version: 1,
                reference: 3,
                standingOrder: { ...hicExpected, orderId },
            },
        },
    ],
    "in",
);
