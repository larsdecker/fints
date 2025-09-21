import { Format } from "../format";
import { StandingOrderSchedule } from "../types";
import { Parse } from "../parse";

export function serializeStandingOrderSchedule(schedule?: StandingOrderSchedule): string[] {
    if (!schedule) {
        return [Format.empty(), Format.empty(), Format.empty(), Format.empty(), Format.empty()];
    }
    const { startDate, timeUnit, interval, executionDay, endDate } = schedule;
    return [
        Format.date(startDate),
        timeUnit,
        Format.num(interval),
        typeof executionDay === "number" ? Format.num(executionDay) : Format.empty(),
        endDate ? Format.date(endDate) : Format.empty(),
    ];
}

export function parseStandingOrderSchedule(data: string[]) {
    const [nextOrder, timeUnit, interval, orderDay, lastOrder] = data;
    return {
        nextOrderDate: Parse.date(nextOrder),
        timeUnit,
        interval: Parse.num(interval),
        orderDay: orderDay ? Parse.num(orderDay) : undefined,
        lastOrderDate: lastOrder ? Parse.date(lastOrder) : null,
    };
}
