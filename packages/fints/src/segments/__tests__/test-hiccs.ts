import { HICCS } from "../hiccs";
import { testSegment } from "./utils";

testSegment(HICCS, [
    {
        serialized: "HICCS:4:1+ORDER123+2+5'",
        structured: {
            type: "HICCS",
            segNo: 4,
            version: 1,
            orderId: "ORDER123",
            consentCode: "2",
            orderStatus: "5",
        },
    },
]);
