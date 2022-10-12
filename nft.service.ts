import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NftInput } from './input/nft.input';
import { Nft } from './nft.entity';
import { User } from '../user/user.entity';
import { NftCategory } from '../nft-category/nft-category.entity';
import { Store } from '../store/store.entity';
import { SlugService } from '../utils/slug/slug.service';
import { PricingService } from '../pricing/pricing.service';
import { NftPurchaseInput } from './nft-purchase.input';
import { TransactionService } from '../transaction/transaction.service';
import { BidService } from '../bid/bid.service';
import {
  FindConditions,
  FindManyOptions,
  In,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UpdateNftInput } from './input/update_nft.input';
import { Pricing } from '../pricing/pricing.entity';
import { RefPricingType } from '../ref-pricing-type/ref-pricing-type.entity';
import { Filter, FilterInput } from './input/filter';

@Injectable()
export class NftService {
  constructor(
    private readonly _slugService: SlugService,
    private readonly _pricingService: PricingService,
    private readonly _transactionService: TransactionService,
    private readonly _bidsService: BidService,
  ) {}

  async create(input: NftInput): Promise<Nft> {
    const owner = await User.findOne({
      where: {
        id: input?.ownerId,
      },
    });
    const category = await NftCategory.findOne({
      where: {
        id: input?.categoryId,
      },
    });
    const store = await Store.findOne({
      where: {
        id: input?.storeId,
      },
    });
    const nft = new Nft();
    Object.assign(nft, input);
    nft.slug = await this._slugService.generateSlug(input?.title, Nft);
    nft.owner = owner;
    nft.category = category;
    nft.store = store;
    await nft.save();
    await this._pricingService.create({
      ...input?.pricing,
      nft: nft.id,
    });
    return nft;
  }
  async update(id: number, input: UpdateNftInput): Promise<Nft> {
    const nft = await Nft.findOneOrFail({
      where: {
        id: id,
      },
    });
    Object.assign(nft, input);
    if (input.pricing) {
      const pricing = await Pricing.findOne({
        where: {
          nft: {
            id: id,
          },
        },
      });
      if (input?.pricing?.type) {
        pricing.type = await RefPricingType.findOne({
          where: {
            label: input?.pricing?.type,
          },
        });
      }
      if (input?.storeId) {
        nft.store = await Store.findOne({
          where: {
            id: input?.storeId,
          },
        });
      }
      pricing.biddingExpiry = input?.pricing?.biddingExpiry;
      pricing.salePrice = input?.pricing?.salePrice;
      pricing.biddingPrice = input?.pricing?.biddingPrice;
      await pricing.save();
      nft.pricing = pricing;
    }

    return await nft.save();
  }
  async delete(id: number): Promise<Nft> {
    const nft = await Nft.findOneOrFail({
      where: {
        id: id,
      },
    });
    return await nft.remove();
  }
  async findAll(options?: FindManyOptions<Nft>): Promise<Nft[]> {
    let manyOptions = {
      relations: ['store', 'owner', 'category', 'type'],
    };
    if (options) {
      manyOptions = {
        ...options,
        ...manyOptions,
      };
    }
    return await Nft.find(manyOptions);
  }
  async findOne(id: number): Promise<Nft> {
    return await Nft.findOneOrFail({
      where: {
        id: id,
      },
    });
  }

  async findBySlug(slug: string): Promise<Nft> {
    return await Nft.findOne({
      where: {
        slug: slug,
      },
      relations: [
        'owner',
        'store',
        'pricing',
        'pricing.currency',
        'pricing.type',
        'bids',
        'bids.currency',
      ],
    });
  }

  async purchase(input: NftPurchaseInput): Promise<Nft> {
    const buyer = await User.findOneOrFail({
      where: {
        id: input?.buyerId,
      },
    });
    const nft = await Nft.findOneOrFail({
      where: {
        id: input?.nftId,
      },
      relations: [
        'owner',
        'store',
        'pricing',
        'pricing.currency',
        'pricing.type',
        'bids',
      ],
    });
    if (!nft?.pricing?.salePrice) {
      throw new HttpException(
        'Sale price is not available on this nft',
        HttpStatus.FORBIDDEN,
      );
    }
    if (buyer.id === nft.owner.id) {
      throw new HttpException(
        "Can't Purchase your own property",
        HttpStatus.FORBIDDEN,
      );
    }
    nft.availability = false;
    await nft.save();

    await this._transactionService.create({
      nftId: nft.id,
      from: input?.buyerId,
      amount: nft.pricing.salePrice,
      to: nft.owner?.id,
    });

    nft.owner = buyer;
    return await nft.save();
  }

  @Cron('0 0 * * *')
  async findClosableBids() {
    const nfts = await Nft.find({
      where: {
        pricing: {
          biddingExpiry: LessThan(new Date()),
        },
      },
      relations: [
        'owner',
        'store',
        'pricing',
        'pricing.currency',
        'pricing.type',
        'bids',
      ],
    });

    for (const nft of nfts) {
      await this.completeBid(nft);
    }
  }

  async completeBid(nft: Nft): Promise<Nft> {
    if (new Date(nft.pricing.biddingExpiry) > new Date()) {
      throw new HttpException(
        'Bidding is not closed yet',
        HttpStatus.FORBIDDEN,
      );
    }
    if (nft.bids.length) {
      const highestBid = await this._bidsService.findHighestByNftId(nft?.id);

      await this._transactionService.create({
        nftId: nft.id,
        to: nft.owner.id,
        from: highestBid.bidder.id,
        amount: highestBid.offerPrice,
      });

      nft.owner = highestBid.bidder;
    }

    nft.availability = false;
    return await nft.save();
  }

  async search(query: string): Promise<Nft[]> {
    return await Nft.find({
      where: {
        title: Like(`%${query}%`),
      },
      relations: ['store', 'owner', 'category', 'type'],
    });
  }

  async parseFilter(query: FilterInput): Promise<Filter> {
    const filter: Filter = {};
    const keys = Object.keys(query);
    for (const key of keys) {
      filter[key] = JSON.parse(query[key]);
    }
    return filter;
  }

  async getFilterConditions(
    params: Filter,
    ownerId?: number,
  ): Promise<FindConditions<Nft>> {
    const findConditions: FindConditions<Nft> = {
      availability: true,
      owner: {
        id: Not(ownerId),
      },
    };

    if (params.category?.id) {
      findConditions.category = {
        id: params?.category?.id,
      };
    }

    if (params.priceRange) {
      if (params?.priceRange?.min) {
        findConditions.pricing = {
          biddingPrice: MoreThanOrEqual(params?.priceRange?.min),
          salePrice: MoreThanOrEqual(params?.priceRange?.min),
        };
      }
      if (params?.priceRange?.max) {
        findConditions.pricing = {
          biddingPrice: LessThanOrEqual(params?.priceRange?.max),
          salePrice: LessThanOrEqual(params?.priceRange?.max),
        };
      }
    }

    if (params.nftType) {
      const labels = Object.keys(params?.nftType);
      const types = labels.filter((l) => !!params.nftType[l]);
      if (types?.length) {
        findConditions.type = {
          label: In(types),
        };
      }
    }

    if (params.pricingType) {
      const labels = Object.keys(params?.pricingType);
      const types = labels.filter((l) => !!params.pricingType[l]);
      if (types?.length) {
        findConditions.pricing = {
          type: {
            label: In(types),
          },
        };
      }
    }
    return findConditions;
  }

  async shop(
    ownerId: number,
    takeInput: { take: string },
    query?: FilterInput,
  ): Promise<Nft[]> {
    const params = await this.parseFilter(query);
    console.log('This is param', params);

    const findConditions = await this.getFilterConditions(params, ownerId);

    return await Nft.find({
      where: findConditions,
      relations: ['store', 'owner', 'category', 'type', 'pricing'],
      take: Number(takeInput.take),
    });
  }

  async view(nftId: number): Promise<Nft> {
    const nft = await Nft.findOne({
      where: {
        id: nftId,
      },
    });
    nft.views += 1;
    return await nft.save();
  }

  async findByUser(userId: number, takeInput: { take: number }) {
    return await Nft.find({
      where: {
        owner: {
          id: userId,
        },
      },
      take: takeInput.take,
    });
  }
}
