import {
    parseResponse,
    isFinTS4Response,
    getXmlValue,
    getXmlString,
    getXmlNumber,
    ensureArray,
    isErrorCode,
    findSegment,
    findSegments,
} from "../xml-parser";
import { FINTS_NAMESPACE } from "../constants";

describe("xml-parser", () => {
    describe("isErrorCode", () => {
        it("returns true for error codes starting with 9", () => {
            expect(isErrorCode("9010")).toBe(true);
            expect(isErrorCode("9999")).toBe(true);
        });

        it("returns false for success codes", () => {
            expect(isErrorCode("0010")).toBe(false);
            expect(isErrorCode("0100")).toBe(false);
        });

        it("returns false for warning codes starting with 3", () => {
            expect(isErrorCode("3010")).toBe(false);
            expect(isErrorCode("3920")).toBe(false);
        });

        it("returns false for empty code", () => {
            expect(isErrorCode("")).toBe(false);
        });
    });

    describe("getXmlValue", () => {
        it("retrieves a top-level value", () => {
            const obj = { name: "test" };
            expect(getXmlValue(obj, "name")).toBe("test");
        });

        it("retrieves a nested value", () => {
            const obj = { a: { b: { c: "deep" } } };
            expect(getXmlValue(obj, "a.b.c")).toBe("deep");
        });

        it("returns undefined for missing path", () => {
            const obj = { a: { b: "test" } };
            expect(getXmlValue(obj, "a.c")).toBeUndefined();
        });

        it("returns undefined for null input", () => {
            expect(getXmlValue(null, "a")).toBeUndefined();
        });

        it("returns undefined for undefined input", () => {
            expect(getXmlValue(undefined, "a")).toBeUndefined();
        });

        it("handles numeric values", () => {
            const obj = { count: 42 };
            expect(getXmlValue(obj, "count")).toBe(42);
        });
    });

    describe("getXmlString", () => {
        it("converts value to string", () => {
            expect(getXmlString({ val: 42 }, "val")).toBe("42");
        });

        it("returns undefined for missing value", () => {
            expect(getXmlString({}, "missing")).toBeUndefined();
        });

        it("returns string values as-is", () => {
            expect(getXmlString({ name: "test" }, "name")).toBe("test");
        });
    });

    describe("getXmlNumber", () => {
        it("parses numeric string", () => {
            expect(getXmlNumber({ val: "42" }, "val")).toBe(42);
        });

        it("returns number values as-is", () => {
            expect(getXmlNumber({ val: 3.14 }, "val")).toBe(3.14);
        });

        it("returns undefined for missing value", () => {
            expect(getXmlNumber({}, "missing")).toBeUndefined();
        });

        it("returns undefined for NaN", () => {
            expect(getXmlNumber({ val: "not a number" }, "val")).toBeUndefined();
        });
    });

    describe("ensureArray", () => {
        it("wraps a single value in an array", () => {
            expect(ensureArray("test")).toEqual(["test"]);
        });

        it("returns an array as-is", () => {
            expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
        });

        it("returns empty array for null", () => {
            expect(ensureArray(null)).toEqual([]);
        });

        it("returns empty array for undefined", () => {
            expect(ensureArray(undefined)).toEqual([]);
        });
    });

    describe("isFinTS4Response", () => {
        it("detects XML responses starting with declaration", () => {
            expect(isFinTS4Response('<?xml version="1.0"?><FinTSMessage/>')).toBe(true);
        });

        it("detects responses starting with FinTSMessage", () => {
            expect(isFinTS4Response("<FinTSMessage>...</FinTSMessage>")).toBe(true);
        });

        it("rejects non-XML responses", () => {
            expect(isFinTS4Response("HNHBK:1:3+000")).toBe(false);
        });

        it("handles whitespace before XML declaration", () => {
            expect(isFinTS4Response("  <?xml")).toBe(true);
        });

        it("rejects empty string", () => {
            expect(isFinTS4Response("")).toBe(false);
        });
    });

    describe("parseResponse", () => {
        it("parses a basic response with dialog ID", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>dialog123</DialogID>
                    </MsgHead>
                    <MsgBody></MsgBody>
                    <MsgTail><MsgNo>1</MsgNo></MsgTail>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.dialogId).toBe("dialog123");
            expect(result.msgNo).toBe(1);
            expect(result.success).toBe(true);
        });

        it("parses success return values", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <ReturnValue>
                            <Code>0010</Code>
                            <Message>Nachricht entgegengenommen</Message>
                        </ReturnValue>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.success).toBe(true);
            expect(result.returnValues.length).toBe(1);
            expect(result.returnValues[0].code).toBe("0010");
            expect(result.returnValues[0].isError).toBe(false);
        });

        it("detects error return values", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <ReturnValue>
                            <Code>9010</Code>
                            <Message>Verarbeitung nicht möglich</Message>
                        </ReturnValue>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.success).toBe(false);
            expect(result.returnValues[0].isError).toBe(true);
        });

        it("parses system ID from sync response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>SyncRes</Type>
                                <Version>1</Version>
                                <SegNo>1</SegNo>
                            </SegHead>
                            <SegBody>
                                <SystemID>sys-abc-123</SystemID>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.systemId).toBe("sys-abc-123");
        });

        it("parses BPD from response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>BPD</Type>
                                <Version>1</Version>
                                <SegNo>2</SegNo>
                            </SegHead>
                            <SegBody>
                                <BPD>
                                    <BankName>Test Bank</BankName>
                                    <BPDVersion>42</BPDVersion>
                                </BPD>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.bpd).toBeDefined();
            expect(result.bpd!.bankName).toBe("Test Bank");
            expect(result.bpd!.bpdVersion).toBe(42);
        });

        it("parses TAN methods from response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>TANMethods</Type>
                                <Version>1</Version>
                                <SegNo>3</SegNo>
                            </SegHead>
                            <SegBody>
                                <TANMethod>
                                    <SecurityFunction>912</SecurityFunction>
                                    <TANProcess>2</TANProcess>
                                    <Name>pushTAN</Name>
                                    <MaxLengthInput>6</MaxLengthInput>
                                </TANMethod>
                                <TANMethod>
                                    <SecurityFunction>913</SecurityFunction>
                                    <TANProcess>1</TANProcess>
                                    <Name>smsTAN</Name>
                                    <MaxLengthInput>8</MaxLengthInput>
                                </TANMethod>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.tanMethods).toBeDefined();
            expect(result.tanMethods!.length).toBe(2);
            expect(result.tanMethods![0].securityFunction).toBe("912");
            expect(result.tanMethods![0].name).toBe("pushTAN");
            expect(result.tanMethods![1].securityFunction).toBe("913");
            expect(result.tanMethods![1].name).toBe("smsTAN");
        });

        it("parses accounts from response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>AccountList</Type>
                                <Version>1</Version>
                                <SegNo>4</SegNo>
                            </SegHead>
                            <SegBody>
                                <Account>
                                    <IBAN>DE89370400440532013000</IBAN>
                                    <BIC>COBADEFFXXX</BIC>
                                    <AccountNumber>0532013000</AccountNumber>
                                    <BLZ>37040044</BLZ>
                                    <OwnerName>Max Mustermann</OwnerName>
                                </Account>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.accounts).toBeDefined();
            expect(result.accounts!.length).toBe(1);
            expect(result.accounts![0].iban).toBe("DE89370400440532013000");
            expect(result.accounts![0].bic).toBe("COBADEFFXXX");
            expect(result.accounts![0].accountOwnerName).toBe("Max Mustermann");
        });

        it("parses camt data from account statement response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead>
                        <MsgNo>1</MsgNo>
                        <DialogID>d1</DialogID>
                    </MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>AccountStatement</Type>
                                <Version>1</Version>
                                <SegNo>5</SegNo>
                            </SegHead>
                            <SegBody>
                                <CamtData>camt xml content here</CamtData>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.camtData).toBe("camt xml content here");
        });

        it("parses holdings from response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead><Type>Holdings</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
                            <SegBody>
                                <Holding>
                                    <ISIN>DE000BASF111</ISIN>
                                    <Name>BASF SE</Name>
                                    <MarketPrice>49.25</MarketPrice>
                                    <Currency>EUR</Currency>
                                    <ValuationDate>2024-06-15</ValuationDate>
                                    <Pieces>12</Pieces>
                                    <TotalValue>591.00</TotalValue>
                                    <AcquisitionPrice>42.10</AcquisitionPrice>
                                </Holding>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;
            const result = parseResponse(xml);
            expect(result.holdings).toHaveLength(1);
            expect(result.holdings![0].isin).toBe("DE000BASF111");
            expect(result.holdings![0].pieces).toBe(12);
        });

        it("parses standing orders from response", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead><Type>StandingOrders</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
                            <SegBody>
                                <StandingOrder>
                                    <NextOrderDate>2024-07-01</NextOrderDate>
                                    <TimeUnit>M</TimeUnit>
                                    <Interval>1</Interval>
                                    <OrderDay>1</OrderDay>
                                    <CreationDate>2024-01-01</CreationDate>
                                    <Debitor><Name>Max Mustermann</Name><IBAN>DE1</IBAN><BIC>BIC1</BIC></Debitor>
                                    <Creditor><Name>Hausverwaltung</Name><IBAN>DE2</IBAN><BIC>BIC2</BIC></Creditor>
                                    <Amount>850</Amount>
                                    <PaymentPurpose>Miete</PaymentPurpose>
                                </StandingOrder>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;
            const result = parseResponse(xml);
            expect(result.standingOrders).toHaveLength(1);
            expect(result.standingOrders![0].timeUnit).toBe("M");
            expect(result.standingOrders![0].amount).toBe(850);
            expect(result.standingOrders![0].debitor.iban).toBe("DE1");
        });

        it("parses task id from transfer response segments", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead><Type>CreditTransferResponse</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
                            <SegBody><TaskId>TASK-123</TaskId></SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;
            const result = parseResponse(xml);
            expect(result.taskId).toBe("TASK-123");
        });

        it("parses segment versions", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody>
                        <Segment>
                            <SegHead>
                                <Type>Balance</Type>
                                <Version>3</Version>
                                <SegNo>1</SegNo>
                            </SegHead>
                            <SegBody></SegBody>
                        </Segment>
                        <Segment>
                            <SegHead>
                                <Type>AccountStatement</Type>
                                <Version>2</Version>
                                <SegNo>2</SegNo>
                            </SegHead>
                            <SegBody></SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.segmentVersions).toBeDefined();
            expect(result.segmentVersions!.get("Balance")).toBe(3);
            expect(result.segmentVersions!.get("AccountStatement")).toBe(2);
        });

        it("parses touchdown from return values", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody>
                        <ReturnValue>
                            <Code>3040</Code>
                            <Message>Es liegen weitere Informationen vor</Message>
                            <Parameter>touchdown-token-abc</Parameter>
                        </ReturnValue>
                    </MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.touchdown).toBe("touchdown-token-abc");
        });

        it("handles response without optional fields", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                    <MsgBody></MsgBody>
                </FinTSMessage>`;

            const result = parseResponse(xml);
            expect(result.dialogId).toBe("d1");
            expect(result.success).toBe(true);
            expect(result.systemId).toBeUndefined();
            expect(result.bpd).toBeUndefined();
            expect(result.tanMethods).toBeUndefined();
            expect(result.accounts).toBeUndefined();
            expect(result.camtData).toBeUndefined();
        });
    });

    describe("findSegment", () => {
        it("finds a segment by type", () => {
            const msgBody = {
                Segment: [
                    { SegHead: { Type: "Seg1", Version: "1", SegNo: "1" }, SegBody: {} },
                    { SegHead: { Type: "Seg2", Version: "2", SegNo: "2" }, SegBody: {} },
                ],
            };

            const result = findSegment(msgBody, "Seg2");
            expect(result).toBeDefined();
            expect((result!.SegHead as Record<string, unknown>).Type).toBe("Seg2");
        });

        it("returns undefined for missing segment", () => {
            const msgBody = {
                Segment: [{ SegHead: { Type: "Seg1", Version: "1", SegNo: "1" }, SegBody: {} }],
            };

            expect(findSegment(msgBody, "Missing")).toBeUndefined();
        });
    });

    describe("findSegments", () => {
        it("finds all segments of a type", () => {
            const msgBody = {
                Segment: [
                    { SegHead: { Type: "Data", Version: "1", SegNo: "1" }, SegBody: { val: "a" } },
                    { SegHead: { Type: "Other", Version: "1", SegNo: "2" }, SegBody: {} },
                    { SegHead: { Type: "Data", Version: "2", SegNo: "3" }, SegBody: { val: "b" } },
                ],
            };

            const results = findSegments(msgBody, "Data");
            expect(results.length).toBe(2);
        });

        it("returns empty array when no segments match", () => {
            const msgBody = {
                Segment: [{ SegHead: { Type: "Seg1", Version: "1", SegNo: "1" }, SegBody: {} }],
            };

            expect(findSegments(msgBody, "Missing")).toEqual([]);
        });
    });
});
