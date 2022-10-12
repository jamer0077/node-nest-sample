import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { Repository } from 'typeorm';
import { AppointmentInput } from './resolvers/appointment.input';
import { Doctor } from '../doctor/doctor.entity';
import { Patient } from '../patient/patient.entity';
import { DoctorInput } from '../doctor/resolvers/doctor.input';
import { PatientInput } from '../patient/resolvers/patient.input';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  async find(): Promise<Appointment[]> {
    return await Appointment.find({
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
  }

  async findOne(id: number): Promise<Appointment> {
    return await Appointment.findOne(id, {
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
  }

  async findByDoctor(doctor: DoctorInput): Promise<Appointment[]> {
    return await Appointment.find({
      where: {
        doctor: {
          id: doctor?.id,
        },
      },
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
  }

  async findByPatient(patient: PatientInput): Promise<Appointment[]> {
    return await Appointment.find({
      where: {
        patient: {
          id: patient?.id,
        },
      },
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
  }

  async create(input: AppointmentInput): Promise<Appointment> {
    const doctor = await Doctor.findOneOrFail(input?.doctor?.id, {
      relations: ['position', 'user', 'appointments'],
    });
    const patient = await Patient.findOneOrFail(input?.patient?.id, {
      relations: ['user', 'appointments'],
    });
    if (input?.amount) {
      throw new BadRequestException(
        'Amount should be added after the appointment is complete!',
      );
    }
    const appointment = new Appointment();
    Object.assign(appointment, {
      ...input,
      doctor: doctor,
      patient: patient,
    });
    return await appointment.save();
  }

  async update(input: AppointmentInput): Promise<Appointment> {
    const appointment = await Appointment.findOneOrFail(input?.id, {
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
    Object.assign(appointment, input);
    return await appointment.save();
  }

  async delete(input: AppointmentInput): Promise<Appointment> {
    const appointment = await Appointment.findOneOrFail(input?.id, {
      relations: ['doctor', 'patient', 'doctor.user', 'patient.user'],
    });
    return await appointment.remove();
  }
}
