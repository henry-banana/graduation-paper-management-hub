import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types';
import {
  UserResponseDto,
  GetUsersQueryDto,
  UpdateUserProfileDto,
} from './dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() currentUser: AuthUser) {
    const user = await this.usersService.findById(currentUser.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      data: this.usersService.mapToDto(user),
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Get()
  @Roles('TBM', 'LECTURER')
  @ApiOperation({ summary: 'List users (TBM/Lecturer only)' })
  @ApiResponse({ status: 200, description: 'List of users with pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - TBM/Lecturer only' })
  async findAll(@Query() query: GetUsersQueryDto) {
    const result = await this.usersService.findAll(query);
    return {
      ...result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Students can only view their own profile
    if (currentUser.role === 'STUDENT' && currentUser.userId !== userId) {
      throw new ForbiddenException('Students can only view their own profile');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      data: this.usersService.mapToDto(user),
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  @Patch(':userId/profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Users can only update their own profile (except TBM)
    if (currentUser.role !== 'TBM' && currentUser.userId !== userId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const result = await this.usersService.updateProfile(userId, dto);

    return {
      data: result,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
