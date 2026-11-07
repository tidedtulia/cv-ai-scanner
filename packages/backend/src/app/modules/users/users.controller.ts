import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { API_ROUTES } from '@org/shared';
import type { IHrSessionUser } from '@org/shared';
import { CurrentHrUser } from '../auth/hr-session.decorators';
import { UsersService } from './users.service';

/** HR accounts — under /api/hr, so every route needs an HR session (HrAuthGuard, hr-auth AC-6 / AC-8) */
@Controller(API_ROUTES.HR_USERS)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.usersService.create(body);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentHrUser() me: IHrSessionUser) {
    return this.usersService.update(id, body, me.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentHrUser() me: IHrSessionUser) {
    return this.usersService.remove(id, me.id);
  }
}
