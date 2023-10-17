import { Body, Controller, Get, Post } from '@nestjs/common';
import { RewardService } from './reward.service';
import { CouponRedeemDto } from './dtos/coupon-redeem.dto';

@Controller('reward')
export class RewardController {
  constructor(private readonly service: RewardService) {}
  @Get()
  dummy() {
    return 'it works';
  }

  @Post('coupon-redeem')
  redeem(@Body() dto: CouponRedeemDto) {
    return this.service.redeemCoupon(dto);
  }
}
