/**
 * Marshal tools for vstorage clients
 *
 * TODO: integrate back into @agoric/rpc
 *  - fixes: calls to makeClientMarshaller share static mutable state
 *    https://github.com/Agoric/ui-kit/issues/73
 *  - fits in this plain .ts project
 */

import { Far, makeMarshal } from '@endo/marshal';

// Type for slots that may be null to indicate identity preservation is not intended
type WildSlot = string | null;

// Interface for the translation table return type
interface TranslationTable<Val> {
    convertValToSlot: (val: Val) => string;
    convertSlotToVal: (slot: WildSlot, iface: string | undefined) => Val;
}

/**
 * Implement conventional parts of convertValToSlot, convertSlotToVal functions
 * for use with makeMarshal based on a slot <-> value translation table,
 * indexed in both directions. Caller supplies functions for making
 * slots, values when not present in the table.
 */
const makeTranslationTable = <Val>(
    makeSlot: (val: Val, size: number) => string,
    makeVal: (slot: WildSlot, iface: string | undefined) => Val
): TranslationTable<Val> => {
    const valToSlot = new Map<Val, string>();
    const slotToVal = new Map<string, Val>();

    const convertValToSlot = (val: Val): string => {
        const existing = valToSlot.get(val);
        if (existing !== undefined) {
            return existing;
        }
        const slot = makeSlot(val, valToSlot.size);
        valToSlot.set(val, slot);
        slotToVal.set(slot, val);
        return slot;
    };

    const convertSlotToVal = (slot: WildSlot, iface: string | undefined): Val => {
        if (slot === null) return makeVal(slot, iface);
        const existing = slotToVal.get(slot);
        if (existing !== undefined) {
            return existing;
        }
        const val = makeVal(slot, iface);
        valToSlot.set(val, slot);
        slotToVal.set(slot, val);
        return val;
    };

    return harden({ convertValToSlot, convertSlotToVal });
};

const synthesizeRemotable = (slot: WildSlot, iface: string | undefined): any => {
    const ifaceStr = iface ?? '';
    const suffix = ifaceStr.endsWith(`#${slot}`) ? '' : `#${slot}`;
    return Far(`${ifaceStr.replace(/^Alleged: /, '')}${suffix}`, {});
};

interface MarshalOptions {
    serializeBodyFormat: 'smallcaps';
}

/**
 * Make a marshaller that synthesizes a remotable the first
 * time it sees a slot identifier, allowing clients to recognize
 * object identity for brands, instances, etc.
 */
export const makeClientMarshaller = (valToSlot?: (v: unknown) => string) => {
    const noNewSlots = (val: unknown): string => {
        throw Error(`unknown value: ${val}`);
    };

    const { convertValToSlot, convertSlotToVal } = makeTranslationTable(
        valToSlot || noNewSlots,
        synthesizeRemotable
    );

    return makeMarshal(convertValToSlot, convertSlotToVal, {
        serializeBodyFormat: 'smallcaps',
    } as MarshalOptions);
};

// Assuming harden is a global function, declare it
declare const harden: <T>(obj: T) => T;