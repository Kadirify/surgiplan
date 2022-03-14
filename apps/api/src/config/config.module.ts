import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
