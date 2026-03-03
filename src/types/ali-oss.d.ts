declare module "ali-oss" {
  interface OSSOptions {
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeySecret: string;
    endpoint?: string;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: string): Promise<unknown>;
  }

  export default OSS;
}
