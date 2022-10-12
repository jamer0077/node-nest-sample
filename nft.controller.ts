import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { NftService } from './nft.service';
import { NftInput } from './input/nft.input';
import { Nft } from './nft.entity';
import { NftPurchaseInput } from './nft-purchase.input';
import { UpdateNftInput } from './input/update_nft.input';
import { FilterInput } from './input/filter';

@Controller('nft')
export class NftController {
  constructor(private nftService: NftService) {}
  @Post()
  async create(@Body() input: NftInput): Promise<Nft> {
    return await this.nftService.create(input);
  }
  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() input: UpdateNftInput,
  ): Promise<Nft> {
    return await this.nftService.update(id, input);
  }
  @Delete(':id')
  async delete(@Param('id') id: number): Promise<Nft> {
    return await this.nftService.delete(id);
  }
  @Get()
  async findAll(@Query() takeInput: { take: string }) {
    return await this.nftService.findAll({
      take: Number(takeInput.take),
    });
  }
  @Get('/my/:userId')
  async findByUser(
    @Param('userId') userId: number,
    @Query() takeInput: { take: string },
  ) {
    return await this.nftService.findByUser(userId, {
      take: Number(takeInput.take),
    });
  }

  @Get('/popular')
  async popular(@Query() takeInput: { take: string }): Promise<Nft[]> {
    return await this.nftService.findAll({
      order: {
        views: 'DESC',
      },
      take: Number(takeInput.take),
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Nft> {
    return await this.nftService.findOne(id);
  }

  @Get('/by-slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<Nft> {
    return await this.nftService.findBySlug(slug);
  }
  @Post('/purchase')
  async createPurchase(@Body() input: NftPurchaseInput): Promise<Nft> {
    return await this.nftService.purchase(input);
  }

  @Get('/search/:query')
  async search(@Param('query') query: string): Promise<Nft[]> {
    return await this.nftService.search(query);
  }

  @Get('/shop/:id')
  async shop(
    @Param('id') id: number,
    @Query() query: FilterInput,
    @Query() takeInput: { take: string },
  ): Promise<Nft[]> {
    return await this.nftService.shop(id, takeInput, query);
  }

  @Post('/:id/view')
  async view(@Param('id') id: number): Promise<Nft> {
    return await this.nftService.view(id);
  }
}
