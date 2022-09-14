const grpc = require("@grpc/grpc-js");
const { LogVerbosity } = require("@grpc/grpc-js/build/src/constants");
const protoLoader = require("@grpc/proto-loader");
const {
  range,
  map,
  switchMap,
  count,
  last,
  tap,
  catchError,
  bindNodeCallback,
  EMPTY,
  mergeMap,
  reduce,
  throwError,
  of,
  defer,
} = require("rxjs");

const concurrency = Number(process.env.CONCURRENCY_PER_CONNECTION) || 100;
const poolSize = Number(process.env.CONNECTION_POOL);
const port = 50051;
const requests = Number(process.env.MESSAGES);
const attempts = Number(process.env.ATTEMPTS) || 10;
const message = "hello";

const protoLoaderArgs = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const getClient = (index) => {
  const PROTO_PATH = __dirname + "/../helloworld.proto";

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, protoLoaderArgs);

  const proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

  return new proto.Greeter(
    `localhost:${port}`,
    grpc.credentials.createInsecure(),
    {
      "grpc.use_local_subchannel_pool": index,
    }
  );
};

const pool = new Array(poolSize).fill().map((v, i, arr) => {
  const client = getClient(i);
  return bindNodeCallback(client.sayHello.bind(client));
});
const echo = (i, ...args) => pool[i % pool.length](...args);

grpc.logVerbosity = LogVerbosity.DEBUG;
console.log(`Performing ${attempts} attempts`);
return range(1, attempts)
  .pipe(
    mergeMap(
      (i) =>
        defer(() => {
          const start = Date.now();
          return range(1, requests).pipe(
            mergeMap((i) => echo(i, { message }), pool.length * concurrency),
            count(),
            last(),
            map((successful) => {
              const time = Date.now() - start;
              const data = {
                errors: requests - successful,
                time,
                rps: Math.round(requests / (time / 1000)),
              };
              return data;
            }),
            catchError((err) => {
              console.error(err);
              return throwError(() => err);
            })
          );
        }),
      1
    ),
    reduce((acc, data) => {
      console.log(data);
      return acc + data.rps;
    }, 0),
    tap((totalRps) => {
      console.log(`Average RPS: ${totalRps / attempts}`);
    })
  )
  .subscribe();
