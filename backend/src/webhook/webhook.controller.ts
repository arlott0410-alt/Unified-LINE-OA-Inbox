import { BadRequestException, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { WebhookService } from './webhook.service';

@Controller('api/webhooks/line')
export class WebhookController {
  constructor(private webhook: WebhookService) {}

  @Post(':oaId')
  async handleLine(
    @Param('oaId') oaId: string,
    @Req() req: FastifyRequest<{ Body: unknown }> & { rawBody?: Buffer },
    @Headers('x-line-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const bodyStr = rawBody.toString('utf8');
    const channelSecret = await this.webhook.getOaChannelSecret(oaId);
    if (!channelSecret) throw new BadRequestException('Unknown OA');
    const valid = this.webhook.verifyLineSignature(bodyStr, signature ?? '', channelSecret);
    if (!valid) throw new BadRequestException('Invalid signature');
    await this.webhook.storeAndEnqueue(oaId, JSON.parse(bodyStr));
    return {};
  }
}
