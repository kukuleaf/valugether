import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './common/http/configure-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  const host =
    process.env.API_HOST?.trim() || (process.env.NODE_ENV === 'test' ? '127.0.0.1' : '0.0.0.0');
  await app.listen(Number(process.env.PORT ?? 3000), host);
}
bootstrap();
