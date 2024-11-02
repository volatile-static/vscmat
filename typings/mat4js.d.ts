declare module 'mat-for-js' {
  export function read(buffer: ArrayBuffer): {
    header: {
      version: number;
      endian: string;
      dataType: string;
      rows: number;
      cols: number;
      name: string;
    };
    data: any;
  };
}
