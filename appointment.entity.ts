import { Directive, Field, Int, ObjectType } from '@nestjs/graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppointmentInterface } from './appointment.interface';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';

@ObjectType()
@Entity('appointments', { schema: 'public' })
@Directive('@key(fields: "id")')
export class Appointment extends BaseEntity implements AppointmentInterface {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field(() => Doctor)
  @ManyToOne(() => Doctor, (doctor) => doctor.appointments)
  @JoinColumn({ name: 'doctor_id', referencedColumnName: 'id' })
  doctor: Doctor;

  @Field(() => Patient)
  @ManyToOne(() => Patient, (patient) => patient.appointments)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: Patient;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'appointment_date' })
  appointmentDate: Date;

  @Field()
  @CreateDateColumn({ name: 'booking_date' })
  bookingDate: Date;

  @Field(() => String)
  @Column({ default: 'Pending' })
  status: string;

  @Field(() => Number, { nullable: true })
  @Column({ nullable: true })
  amount: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field({ nullable: true })
  @UpdateDateColumn({ nullable: true })
  updatedAt: Date;
}
