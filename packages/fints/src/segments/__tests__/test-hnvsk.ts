import { HNVSK } from "../hnvsk";
import { testSegment } from "./utils";
import { Format } from "../../format";

jest.spyOn(Format, "date").mockReturnValue("20180907");
jest.spyOn(Format, "time").mockReturnValue("080000");

afterAll(() => jest.restoreAllMocks());

testSegment(
    HNVSK,
    [
        {
            serialized:
                "HNVSK:998:3+PIN:1+998+1+1::some-system-id+1:20180907:080000+2:2:13:@8@00000000:5:1+280:12345678:testuser:S:0:0+0'", // tslint:disable-line
            structured: {
                type: "HNVSK",
                segNo: 998,
                version: 3,
                profileVersion: 1,
                systemId: "some-system-id",
                blz: "12345678",
                name: "testuser",
            },
        },
        {
            serialized:
                "HNVSK:998:3+PIN:1+998+1+1::some-system-id+1:20180907:080000+2:2:13:@8@00000000:5:1+280:12345678:user?@example.com:S:0:0+0'", // tslint:disable-line
            structured: {
                type: "HNVSK",
                segNo: 998,
                version: 3,
                profileVersion: 1,
                systemId: "some-system-id",
                blz: "12345678",
                name: "user@example.com",
            },
        },
    ],
    "bi",
);
