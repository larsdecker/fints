import { HICAZS } from "../hicazs";
import { testSegment } from "./utils";

testSegment(
    HICAZS,
    [
        {
            serialized: "HICAZS:12:1:3+1+2+1+90:J:J:camt.052'",
            structured: {
                type: "HICAZS",
                segNo: 12,
                version: 1,
                reference: 3,
                maxDays: 90,
                camtFormat: "camt.052",
            },
        },
    ],
    "in",
);
