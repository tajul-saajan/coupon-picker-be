import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reward } from '../entities/Reward';
import { Repository } from 'typeorm';
import { CouponRedeemDto } from './dtos/coupon-redeem.dto';
import { Player } from '../entities/Player';
import * as moment from 'moment';
import { PlayerCoupon } from '../entities/PlayerCoupon';
import { Coupon } from '../entities/Coupon';

@Injectable()
export class RewardService {
  constructor(
    @InjectRepository(Reward)
    private readonly rewardRepository: Repository<Reward>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(PlayerCoupon)
    private readonly playerCouponRepository: Repository<PlayerCoupon>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  async redeemCoupon(dto: CouponRedeemDto) {
    const { playerId, rewardId } = dto;

    const reward = await this.rewardRepository.findOne({
      where: {
        id: rewardId,
      },
    });
    const player = await this.playerRepository.findOne({
      where: {
        id: playerId,
      },
    });

    if (!reward || !player)
      throw new HttpException(
        'Reward id or Player id is invalid',
        HttpStatus.NOT_FOUND,
      );

    const today = moment();
    if (!this.isValid(reward))
      throw new HttpException(
        'Coupon is not valid anymore',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    const query = this.playerCouponRepository
      .createQueryBuilder('player_coupon')
      .innerJoinAndSelect(
        'player_coupon.coupon',
        'coupon',
        'coupon.rewardId = :rewardId',
        {
          rewardId,
        },
      );

    const allRedeemedCouponCount = await query.clone().getCount();
    if (allRedeemedCouponCount >= reward.totalLimit)
      throw new HttpException(
        'total limit already reached',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    const todayRedeemedCouponCount = await query
      .clone()
      .where(`DATE(player_coupon.redeemedAt) = CURRENT_DATE`)
      .getCount();

    if (todayRedeemedCouponCount >= reward.perDayLimit)
      throw new HttpException(
        'daily limit already reached',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    const availedCoupons = await query.clone().loadAllRelationIds().getMany();

    const ids = availedCoupons.map((c) => c.coupon);

    const firstUnAvailed = await this.couponRepository
      .createQueryBuilder('coupon')
      .where('coupon.id NOT IN (:...ids)', { ids })
      .getOneOrFail();

    await this.playerCouponRepository.save({
      coupon: firstUnAvailed,
      player: player,
      redeemedAt: today.toDate(),
    });

    return firstUnAvailed;
  }

  async findAllRewards() {
    return await this.rewardRepository.find();
  }

  async findAllPlayers() {
    return await this.playerRepository.find();
  }

  async findAllCoupons() {
    return await this.couponRepository.find();
  }

  async findAllPlayerCoupons() {
    return await this.playerCouponRepository.find();
  }

  isValid({ startDate, endDate }: Reward): boolean {
    const today = moment();
    return today.isBetween(startDate, endDate);
  }
}