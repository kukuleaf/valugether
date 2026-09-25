import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './common/http/configure-http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  await app.listen(Number(process.env.PORT ?? 3000));
}
bootstrap();
