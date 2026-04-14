/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'qtdatastream' {
  export class ReadBuffer {
    buffer: Buffer;
    read_offset: number;
    constructor(data: Buffer);
    readInt8(): number;
    readUInt16BE(): number;
    slice(length: number): Buffer;
  }

  export namespace buffer {
    export { ReadBuffer };
  }

  export abstract class QClass {
    static qtype: number;
    static types: Map<number, typeof QClass>;
    static read(buffer: ReadBuffer): any;
    static from(value: any): QClass;
    __obj: any;
    toBuffer(includeType?: boolean): Buffer;
  }

  export class QInt extends QClass {
    static read(buffer: ReadBuffer): number;
    static from(value: number | string): QInt;
    __obj: number;
  }

  export class QUInt extends QClass {
    static read(buffer: ReadBuffer): number;
    static from(value: number | string): QUInt;
    __obj: number;
  }

  export class QDouble extends QClass {
    static read(buffer: ReadBuffer): number;
    static from(value: number): QDouble;
    __obj: number;
  }

  export class QBool extends QClass {
    static read(buffer: ReadBuffer): boolean;
    static from(value: boolean): QBool;
    __obj: boolean;
  }

  export class QString extends QClass {
    static read(buffer: ReadBuffer): string;
    static from(value: string): QString;
    __obj: string;
    toBuffer(includeType?: boolean): Buffer;
  }

  export interface QUserTypeRegistry {
    read(buffer: ReadBuffer): any;
    from(value: any): { toBuffer(includeType?: boolean): Buffer };
  }

  export class QUserType extends QClass {
    static register(name: string, fields: Record<string, any>[]): void;
    static get(name: string): QUserTypeRegistry;
    static read(buffer: ReadBuffer, name: string): any;
  }

  export const Types: {
    BOOL: number;
    INT: number;
    UINT: number;
    DOUBLE: number;
    STRING: number;
    POINT: number;
    FONT: number;
    PIXMAP: number;
    COLOR: number;
    VECTOR: number;
    [key: string]: number;
  };

  export function qtype(typeId: number): (cls: typeof QClass) => void;

  export namespace types {
    export { QClass, QInt, QUInt, QDouble, QBool, QString, QUserType, Types, qtype };
  }
}

declare module 'qtdatastream/src/types' {
  export {
    QClass,
    QInt,
    QUInt,
    QDouble,
    QBool,
    QString,
    QUserType,
    qtype,
  } from 'qtdatastream';
}
