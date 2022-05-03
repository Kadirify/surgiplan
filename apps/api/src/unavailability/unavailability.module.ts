import { Module } from '@nestjs/common';
import { UnavailabilityController } from './unavailability.controller';

@Module({ controllers: [UnavailabilityController] })
export class UnavailabilityModule {}
