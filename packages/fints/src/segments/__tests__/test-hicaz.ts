import { HICAZ } from "../hicaz";
import { testSegment } from "./utils";

testSegment(
    HICAZ,
    [
        {
            serialized: "HICAZ:5:1:3+++@10@abcdefghij'",
            structured: {
                type: "HICAZ",
                segNo: 5,
                version: 1,
                reference: 3,
                bookedTransactions: "abcdefghij",
            },
        },
        {
            serialized: "HICAZ:5:1:3++++@10@abcdefghij'",
            structured: {
                type: "HICAZ",
                segNo: 5,
                version: 1,
                reference: 3,
                pendingTransactions: "abcdefghij",
            },
        },
    ],
    "in",
);
