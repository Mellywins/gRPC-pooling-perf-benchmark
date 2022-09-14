# gRPC pooling performance Benchmarking

Example of usage:
Start server

```
node dynamic_codegen/greeter_server.js
```

Run the client

```
CONNECTION_POOL=100 MESSAGES=1000 ATTEMPTS=10 node dynamic_codegen/jason.js
```
